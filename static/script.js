const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const selectFilesButton = document.getElementById("select-files");
const fileList = document.getElementById("file-list");
const mergeButton = document.getElementById("merge-files");
const loadingIndicator = document.getElementById("loading");

let files = [];

async function createPreview(fileObj) {
  const { uuid, file } = fileObj;
  const card = document.createElement("div");
  card.classList.add("file-card");
  card.draggable = true;
  card.dataset.uuid = uuid;

  const CARD_WIDTH = 150;
  const CARD_HEIGHT = 100;
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.alignItems = "center";
  card.style.justifyContent = "flex-end";
  card.style.gap = "8px";
  card.style.width = `${CARD_WIDTH}px`;
  card.style.height = `${CARD_HEIGHT}px`;
  card.style.padding = "10px";
  card.style.border = "1px solid #ddd";
  card.style.borderRadius = "8px";
  card.style.backgroundColor = "#f9f9f9";
  card.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  card.style.textAlign = "center";

  try {
    const name = document.createElement("p");
    name.textContent = file.name;
    name.style.wordBreak = "break-word";
    name.style.textAlign = "center";
    name.style.margin = "5px 0";
    name.style.fontSize = "14px";
    name.style.fontWeight = "bold";
    name.style.maxWidth = "90%";

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove File";
    removeButton.style.width = "90%";
    removeButton.style.height = "30px";
    removeButton.style.marginTop = "5px";
    removeButton.style.backgroundColor = "#ff4d4f";
    removeButton.style.color = "#fff";
    removeButton.style.border = "none";
    removeButton.style.borderRadius = "5px";
    removeButton.style.cursor = "pointer";
    removeButton.style.fontSize = "14px";
    removeButton.style.display = "flex";
    removeButton.style.justifyContent = "center";
    removeButton.style.alignItems = "center";
    removeButton.style.padding = "0";

    removeButton.addEventListener("mouseover", () => {
      removeButton.style.backgroundColor = "#ff7875";
    });

    removeButton.addEventListener("mouseout", () => {
      removeButton.style.backgroundColor = "#ff4d4f";
    });

    removeButton.addEventListener("click", () => {
      files = files.filter((f) => f.uuid !== uuid);
      card.remove();
      mergeButton.disabled = files.length <= 1;
    });

    card.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("file-card")) {
        e.dataTransfer.setData("text/plain", uuid);
        e.target.classList.add("dragging");
      }
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingElement = document.querySelector(".dragging");
      const target = e.target.closest(".file-card");

      if (target && target !== draggingElement) {
        fileList.insertBefore(
          draggingElement,
          draggingElement.compareDocumentPosition(target) & 4
            ? target.nextSibling
            : target
        );
      }
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggingUuid = e.dataTransfer.getData("text/plain");
      const targetUuid = e.target.closest(".file-card")?.dataset.uuid;

      if (draggingUuid && targetUuid && draggingUuid !== targetUuid) {
        const draggingIndex = files.findIndex((f) => f.uuid === draggingUuid);
        const targetIndex = files.findIndex((f) => f.uuid === targetUuid);

        const [draggedItem] = files.splice(draggingIndex, 1);
        files.splice(targetIndex, 0, draggedItem);

        updateCardOrder();
      }

      document.querySelector(".dragging")?.classList.remove("dragging");
    });

    card.appendChild(name);
    card.appendChild(removeButton);
    fileList.appendChild(card);
  } catch (error) {
    console.error("Error rendering PDF preview:", error);
    alert(`Failed to render preview for file: ${file.name}`);
  }
}


function updateCardOrder() {
  const cards = Array.from(fileList.children);

  cards.forEach((card, index) => {
    const uuid = card.dataset.uuid;
    const fileObj = files.find((f) => f.uuid === uuid);

    if (fileObj) {
      const nameElement = card.querySelector("p");
      if (nameElement) {
        nameElement.textContent = fileObj.file.name;
      }
    }
  });
}

async function handleFiles(selectedFiles) {
  const newFiles = Array.from(selectedFiles).map((file) => ({
    uuid: crypto.randomUUID(),
    file,
  }));

  files = files.concat(newFiles);

  newFiles.forEach(createPreview);
  mergeButton.disabled = files.length <= 1;
}

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

selectFilesButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => handleFiles(fileInput.files));

mergeButton.addEventListener("click", async () => {
  if (files.length < 2) {
    alert("Too few files. Minimum allowed is 2.");
    return;
  }

  mergeButton.disabled = true;
  loadingIndicator.style.display = "block";

  const orderedFiles = Array.from(fileList.children).map((child) => {
    const uuid = child.dataset.uuid;
    return files.find((fileObj) => fileObj.uuid === uuid);
  });

  const formData = new FormData();
  orderedFiles.forEach((fileObj) => formData.append("files", fileObj.file));

  try {
    const response = await fetch("/merge", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const { file } = data;

      if (file) {
        let downloadButton = document.getElementById("download-button");

        if (!downloadButton) {
          downloadButton = document.createElement("button");
          downloadButton.id = "download-button";
          downloadButton.classList.add("download-button");
          downloadButton.textContent = "Download Merged File";
          document.getElementById("download-area").appendChild(downloadButton); // download-area에 추가
        }

        downloadButton.onclick = async () => {
          try {
            const response = await fetch(`/download/${file}`, {
              method: "GET",
            });

            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const tempLink = document.createElement("a");
              tempLink.href = url;
              tempLink.download = file;
              tempLink.click();
              URL.revokeObjectURL(url);
            } else {
              alert("Failed to download the file.");
            }
          } catch (error) {
            alert("An error occurred while downloading the file.");
          }
        };
      } else {
        alert("Failed to merge PDFs.");
      }
    } else {
      alert("Server returned an error.");
    }
  } catch (error) {
    alert("An error occurred.");
  } finally {
    loadingIndicator.style.display = "none";
    mergeButton.disabled = false;
  }
});
