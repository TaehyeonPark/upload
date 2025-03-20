const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const selectFilesButton = document.getElementById("select-files");
const fileList = document.getElementById("file-list");
const uploadButton = document.getElementById("upload-files");
const loadingIndicator = document.getElementById("loading");

let files = [];

async function createPreview(fileObj) {
  const { uuid, file } = fileObj;
  const card = document.createElement("div");
  card.classList.add("file-card");
  card.draggable = true;
  card.dataset.uuid = uuid;

  try {
    const name = document.createElement("p");
    name.classList.add("file-name");
    name.textContent = file.name;

    const removeButton = document.createElement("button");
    removeButton.classList.add("file-remove");
    removeButton.textContent = "Remove File";

    removeButton.addEventListener("click", () => {
      files = files.filter((f) => f.uuid !== uuid);
      card.remove();
      uploadButton.disabled = files.length <= 0;
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
    console.error("Error rendering preview:", error);
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
  uploadButton.disabled = files.length <= 0;
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

uploadButton.addEventListener("click", async () => {
  if (files.length < 1) {
    alert("Too few file(s). Minimum allowed is 1.");
    return;
  }

  uploadButton.disabled = true;
  loadingIndicator.style.display = "block";

  const orderedFiles = Array.from(fileList.children).map((child) => {
    const uuid = child.dataset.uuid;
    return files.find((fileObj) => fileObj.uuid === uuid);
  });

  const formData = new FormData();
  orderedFiles.forEach((fileObj) => formData.append("files", fileObj.file));

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const { file } = data;
      if (file) {
        const file_dict = JSON.parse(file);
        let downloadArea = document.getElementById("download-area");
        downloadArea.innerHTML = "";
        for (const key in file_dict) {
          let downloadButton = document.createElement("button");
          downloadButton.id = "download-button";
          downloadButton.classList.add("download-button");
          downloadButton.textContent = `Download ${key}`;
          downloadButton.onclick = async () => {
            try {
              const response = await fetch(`/download/${file_dict[key]}`, {
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
          let downloadCommand = document.createElement("button");
          downloadCommand.classList.add("file-curl");

          const downCmd = `curl -X GET "${window.location.href}${file_dict[key]}"`;
          downloadCommand.textContent = downCmd;
          downloadCommand.addEventListener("click", () => {
            navigator.clipboard.writeText(downCmd).then(() => {
              fileCurl.classList.add("copied");
              setTimeout(() => {
                fileCurl.classList.add("fade-out");
                setTimeout(() => fileCurl.classList.remove("copied", "fade-out"), 500);
              }, 1000);
            })
            .catch(err => console.error("복사 실패:", err));
          });

          downloadArea.appendChild(downloadButton);
          downloadArea.appendChild(downloadCommand);
        }
        
      } else {
        alert("Failed to upload file(s).");
      }
    } else {
      alert("Server returned an error.");
    }
  } catch (error) {
    alert("An error occurred.");
  } finally {
    loadingIndicator.style.display = "none";
    uploadButton.disabled = false;
  }
});
