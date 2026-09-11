import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const loaderSource = await readFile(new URL("../public/claire-embed.js", import.meta.url), "utf8");
const frameSource = await readFile(new URL("../public/embed/frame.js", import.meta.url), "utf8");
const frameHtml = await readFile(new URL("../public/embed/index.html", import.meta.url), "utf8");
const frameStyles = await readFile(new URL("../public/embed/styles.css", import.meta.url), "utf8");

function loaderHarness() {
  const appended = [];
  const events = [];
  const document = {
    currentScript: null,
    body: { appendChild(node) { appended.push(node); } },
    querySelector() { return null; },
    createElement(name) {
      return {
        nodeName: name.toUpperCase(),
        dataset: {},
        style: {},
        contentWindow: {},
        setAttribute(attribute, value) { this[attribute] = value; },
        addEventListener() {}
      };
    }
  };
  const window = {
    location: { href: "http://localhost:4173/page", origin: "http://localhost:4173" },
    innerWidth: 1024,
    innerHeight: 800,
    fetch: async (url) => {
      assert.equal(url.href, "http://localhost:8787/api/embed/bootstrap?tenant=boulangerie-soleil");
      return {
        ok: true,
        async json() {
          return {
            embedTicket: "dev_ticket",
            tenant: { persona: { name: "Claire" } }
          };
        }
      };
    },
    addEventListener() {},
    dispatchEvent(event) { events.push(event); },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    console
  };
  window.window = window;
  return { window, document, appended, events };
}

test("loader mounts a sandboxed iframe using data-tenant and a bootstrap ticket", async () => {
  const harness = loaderHarness();
  vm.runInNewContext(loaderSource, {
    window: harness.window,
    document: harness.document,
    URL,
    Object,
    Promise,
    encodeURIComponent,
    console
  });
  const script = {
    src: "http://localhost:8787/claire-embed.js",
    dataset: {
      tenant: "boulangerie-soleil",
      origin: "http://localhost:4173"
    }
  };

  const iframe = await harness.window.ClaireEmbed.mount(script);

  assert.equal(harness.appended.length, 2);
  assert.equal(iframe.nodeName, "IFRAME");
  assert.equal(iframe.dataset.claireTenant, "boulangerie-soleil");
  assert.match(iframe.src, /^http:\/\/localhost:8787\/embed\/\?tenant=boulangerie-soleil#ticket=dev_ticket$/);
  assert.match(iframe.allow, /microphone/);
  assert.match(iframe.sandbox, /allow-scripts/);
  assert.match(iframe.style.cssText, /inset:0/);
  assert.match(iframe.style.cssText, /width:100vw/);
  assert.match(iframe.style.cssText, /height:100dvh/);
  assert.match(iframe.style.cssText, /border-radius:0/);
  assert.match(iframe.style.cssText, /box-shadow:none/);
  assert.equal(harness.appended[1].nodeName, "BUTTON");
  assert.equal(script.dataset.claireMounted, "true");
  assert.equal(harness.events[0].type, "claire:mounted");
});

test("loader refuses a declared origin that differs from the host page", async () => {
  const harness = loaderHarness();
  vm.runInNewContext(loaderSource, {
    window: harness.window,
    document: harness.document,
    URL,
    Object,
    Promise,
    encodeURIComponent,
    console
  });

  await assert.rejects(
    harness.window.ClaireEmbed.mount({
      src: "http://localhost:8787/claire-embed.js",
      dataset: { tenant: "boulangerie-soleil", origin: "https://spoofed.example" }
    }),
    /does not match/
  );
  assert.equal(harness.appended.length, 0);
});

test("iframe UI keeps the LiveAvatar stage in a centered 9:16 frame", () => {
  assert.match(frameHtml, /<div class="stage-frame">[\s\S]*<video id="avatar"/);
  assert.match(frameStyles, /\.stage-frame\s*\{[\s\S]*aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(frameStyles, /\.stage video\s*\{[\s\S]*object-fit:\s*cover;[\s\S]*object-position:\s*center/);
  assert.match(frameStyles, /\.stage\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0/);
  assert.match(frameStyles, /\.shell\.chrome-card\s*\{/);
  assert.match(frameStyles, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(frameStyles, /minmax\(210px,\s*42%\)/);
});

test("direct iframe URL bootstraps its own ticket when the hash is missing", async () => {
  const calls = [];
  const button = { disabled: true };
  const elements = new Map();
  for (const selector of [
    "#avatar", "#placeholder", "#status", "#claire-name", "#greeting", "#transcript",
    "#start", "#close", "#contact", "#lead-overlay", "#lead-close", "#lead-form",
    "#lead-result", "#chat-form", "#message"
  ]) {
    elements.set(selector, {
      addEventListener() {},
      querySelector() { return button; },
      append() {},
      reset() {},
      disabled: false,
      hidden: false,
      textContent: "",
      value: ""
    });
  }
  const fetch = async (path, options = {}) => {
    calls.push({ path, options });
    if (String(path).startsWith("/api/embed/bootstrap")) {
      return {
        ok: true,
        async json() { return { embedTicket: "dogfood-ticket" }; }
      };
    }
    if (String(path).startsWith("/api/tenant")) {
      return {
        ok: true,
        async json() {
          return {
            tenant: {
              displayName: "Boulangerie du Soleil",
              persona: { name: "Claire", greeting: "Bonjour dogfood" }
            }
          };
        }
      };
    }
    throw new Error(`Unexpected request ${path}`);
  };

  vm.runInNewContext(frameSource, {
    URL,
    URLSearchParams,
    encodeURIComponent,
    location: { href: "https://claire-platform-dev.infoserv2a.workers.dev/embed/?tenant=boulangerie-soleil", hash: "" },
    history: { replaceState() {} },
    document: {
      title: "",
      querySelector(selector) { return elements.get(selector); },
      createElement() { return { append() {}, scrollIntoView() {}, textContent: "" }; },
      createTextNode(value) { return value; }
    },
    parent: { postMessage() {} },
    addEventListener() {},
    fetch,
    FormData: class FormData {},
    Object,
    String,
    Promise,
    console
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls[0].path, "/api/embed/bootstrap?tenant=boulangerie-soleil");
  assert.equal(calls[1].path, "/api/tenant?tenant=boulangerie-soleil");
  assert.equal(calls[1].options.headers.Authorization, "Bearer dogfood-ticket");
  assert.equal(elements.get("#greeting").textContent, "Bonjour dogfood");
  assert.equal(elements.get("#start").disabled, false);
});
