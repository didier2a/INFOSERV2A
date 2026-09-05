(function () {
  function initContactForm(root = document) {
    const form = root.querySelector?.("#contact-form");
    if (!form || !window.InfoServ || form.dataset.infoservBound === "true") return;
    form.dataset.infoservBound = "true";
    const api = window.InfoServ;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = form.querySelector("#contact-name");
      const email = form.querySelector("#contact-email");
      const phone = form.querySelector("#contact-phone");
      const message = form.querySelector("#contact-message");
      let ok = true;

      ok = api.required(name, "votre nom") && ok;
      ok = api.required(email, "votre e-mail") && ok;
      ok = api.required(message, "votre message") && ok;

      if (email.value && !api.emailPattern.test(email.value)) {
        api.setError(email, "L'adresse e-mail n'est pas valide.");
        ok = false;
      }
      if (phone.value && !api.phonePattern.test(phone.value)) {
        api.setError(phone, "Le numéro de téléphone n'est pas valide.");
        ok = false;
      }

      if (!ok) {
        api.showStatus(form, "error", "Merci de corriger les champs indiqués.");
        return;
      }

      const send = api.sendSiteEmail
        ? api.sendSiteEmail({
            kind: "contact",
            name: name.value,
            email: email.value,
            phone: phone.value,
            message: message.value,
            website: form.querySelector("[name='website']")?.value || ""
          })
        : Promise.reject(new Error("send"));

      send.then((result) => {
        if (result.pendingActivation) {
          api.showStatus(form, "ok", result.message || "Un e-mail d’activation arrive dans " + (result.inbox || email.value) + ". Confirmez-le, puis renvoyez le message.");
          return;
        }
        if (!result.sent) throw new Error(result.error || "network");
        api.showStatus(form, "ok", "Votre message a bien été transmis vers " + (result.inbox || email.value) + ".");
        document.dispatchEvent(new CustomEvent("infoserv:email-sent", {
          detail: {
            kind: "contact",
            inbox: result.inbox,
            replyTo: result.replyTo,
            name: name.value,
            email: email.value,
            phone: phone.value,
            message: message.value
          }
        }));
        form.reset();
      }).catch(() => {
        api.showStatus(form, "error", "L'envoi n'a pas pu aboutir. Vérifiez l’e-mail indiqué, puis réessayez.");
      });
    });
  }

  initContactForm();
  document.addEventListener("infoserv:content-changed", () => initContactForm(document.querySelector("#contenu")));
})();
