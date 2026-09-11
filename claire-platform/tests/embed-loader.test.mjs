import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const loaderSource = await readFile(new URL("../public/claire-embed.js", import.meta.url), "utf8");

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
        contentWindow: {}
      };
    }
  };
  const window = {
    location: { href: "http://localhost:4173/page", origin: "http://localhost:4173" },
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

  assert.equal(harness.appended.length, 1);
  assert.equal(iframe.nodeName, "IFRAME");
  assert.equal(iframe.dataset.claireTenant, "boulangerie-soleil");
  assert.match(iframe.src, /^http:\/\/localhost:8787\/embed\/\?tenant=boulangerie-soleil#ticket=dev_ticket$/);
  assert.match(iframe.allow, /microphone/);
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
