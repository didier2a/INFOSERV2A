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

      if (api.isLocal) {
        api.showStatus(
          form,
          "ok",
          "Mode local : votre demande a été validée. Aucun e-mail n'est envoyé depuis cet ordinateur."
        );
        form.reset();
        return;
      }

      if (!form.dataset.endpoint) {
        const mail = form.dataset.mail || "contact@infoserv2a.pro";
        const subject = encodeURIComponent("Contact InfoServ2A");
        const body = encodeURIComponent(
          "Nom : " + name.value + "\nE-mail : " + email.value + "\nTéléphone : " + (phone.value || "") + "\n\n" + message.value
        );
        window.location.href = "mailto:" + mail + "?subject=" + subject + "&body=" + body;
        api.showStatus(form, "ok", "Votre logiciel de messagerie va s'ouvrir. Vérifiez le message puis envoyez-le à " + mail + ".");
        return;
      }

      fetch(form.dataset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
        .then((response) => {
          if (!response.ok) throw new Error("network");
          api.showStatus(form, "ok", "Votre message a bien été transmis.");
          form.reset();
        })
        .catch(() => {
          api.showStatus(form, "error", "L'envoi n'a pas pu aboutir. Vous pouvez nous écrire à contact@infoserv2a.pro.");
        });
    });
  }

  initContactForm();
  document.addEventListener("infoserv:content-changed", () => initContactForm(document.querySelector("#contenu")));
})();
