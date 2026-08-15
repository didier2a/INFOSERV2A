(function () {
  const form = document.querySelector("#devis-form");
  if (!form || !window.InfoServ) return;
  const api = window.InfoServ;
  const filesInput = form.querySelector("#devis-files");
  const dropzone = form.querySelector(".dropzone");
  const dropLabel = form.querySelector("[data-drop-label]");

  if (dropzone && filesInput) {
    const refresh = () => {
      if (!dropLabel) return;
      const count = filesInput.files.length;
      dropLabel.textContent = count
        ? count + " fichier(s) sélectionné(s)"
        : "Déposez vos fichiers ici ou parcourez";
    };
    dropzone.addEventListener("click", () => filesInput.click());
    ["dragenter", "dragover"].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-over");
      });
    });
    dropzone.addEventListener("drop", (event) => {
      if (event.dataTransfer.files.length) {
        filesInput.files = event.dataTransfer.files;
        refresh();
      }
    });
    filesInput.addEventListener("change", refresh);
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        filesInput.click();
      }
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = {
      name: form.querySelector("#devis-name"),
      phone: form.querySelector("#devis-phone"),
      email: form.querySelector("#devis-email"),
      city: form.querySelector("#devis-city"),
      service: form.querySelector("#devis-service"),
      description: form.querySelector("#devis-description")
    };
    let ok = true;

    ok = api.required(fields.name, "votre nom et prénom") && ok;
    ok = api.required(fields.phone, "votre téléphone") && ok;
    ok = api.required(fields.email, "votre e-mail") && ok;
    ok = api.required(fields.city, "votre commune") && ok;
    ok = api.required(fields.service, "le type de service") && ok;
    ok = api.required(fields.description, "la description du besoin") && ok;

    if (fields.email.value && !api.emailPattern.test(fields.email.value)) {
      api.setError(fields.email, "L'adresse e-mail n'est pas valide.");
      ok = false;
    }
    if (fields.phone.value && !api.phonePattern.test(fields.phone.value)) {
      api.setError(fields.phone, "Le numéro de téléphone n'est pas valide.");
      ok = false;
    }

    const files = filesInput ? [...filesInput.files] : [];
    if (files.length > api.maxFiles) {
      api.setError(filesInput, "Cinq fichiers maximum.");
      ok = false;
    } else {
      const tooHeavy = files.find((file) => file.size > api.maxFileSize);
      const badType = files.find((file) => {
        const ext = "." + file.name.split(".").pop().toLowerCase();
        return !api.accepted.includes(ext);
      });
      if (tooHeavy) {
        api.setError(filesInput, "Chaque fichier doit rester inférieur à 8 Mo.");
        ok = false;
      } else if (badType) {
        api.setError(filesInput, "Format non accepté. Utilisez JPG, PNG, WEBP, PDF, DOC, DOCX ou TXT.");
        ok = false;
      } else if (filesInput) {
        api.setError(filesInput, "");
      }
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
      const mail = form.dataset.mail || "devis@infoserv2a.pro";
      const subject = encodeURIComponent("Demande de devis InfoServ2A");
      const body = encodeURIComponent(
        "Nom : " + fields.name.value +
        "\nTéléphone : " + fields.phone.value +
        "\nE-mail : " + fields.email.value +
        "\nCommune : " + fields.city.value +
        "\nService : " + fields.service.value +
        "\n\n" + fields.description.value +
        "\n\nFichiers à joindre manuellement : " + (files.map((file) => file.name).join(", ") || "aucun")
      );
      window.location.href = "mailto:" + mail + "?subject=" + subject + "&body=" + body;
      api.showStatus(form, "ok", "Votre logiciel de messagerie va s'ouvrir. Joignez-y les fichiers indiqués, puis envoyez le message à " + mail + ".");
      return;
    }

    fetch(form.dataset.endpoint, { method: "POST", body: new FormData(form) })
      .then((response) => {
        if (!response.ok) throw new Error("network");
        api.showStatus(form, "ok", "Votre demande de devis a bien été transmise.");
        form.reset();
      })
      .catch(() => {
        api.showStatus(form, "error", "L'envoi n'a pas pu aboutir. Vous pouvez nous écrire à devis@infoserv2a.pro.");
      });
  });
})();
