

// #region FIREBASE & IMAGE UPLOAD
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase, ref as dbRef, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// Your web app's Firebase configuration (using config from structure.html)
const firebaseConfig = {
    apiKey: "AIzaSyCIfleywEbd1rcjymkfEfFYxPpvYdZHGhk",
    authDomain: "cvang-vahan.firebaseapp.com",
    databaseURL: "https://cvang-vahan-default-rtdb.firebaseio.com",
    projectId: "cvang-vahan",
    storageBucket: "cvang-vahan.appspot.com",
    messagingSenderId: "117318825099",
    appId: "1:117318825099:web:afc0e2f863117cb14bfc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const imagesRef = dbRef(db, 'images');

// Cloudinary configuration (from structure.html)
const cloudName = 'dugehr9nl'; // Replace with your Cloudinary cloud name
const uploadPreset = 'anonymous_upload'; // Replace with your Cloudinary upload preset
// Handle paste event for images
document.addEventListener("paste", function (event) {
    const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;
    const items = Array.from(clipboardData?.items || []);
    const imageFiles = items
        .filter(item => item.type && item.type.indexOf("image") === 0)
        .map(item => item.getAsFile())
        .filter(Boolean);

    if (!imageFiles.length) return;

    event.preventDefault();

    const tagInput = document.getElementById("tagInput");
    const passwordInput = document.getElementById("passwordInput");
    const progressBar = document.getElementById("progress");
    const statusText = document.getElementById("status");
    const tag = tagInput?.value.trim() || "ClipboardImage";
    const password = passwordInput?.value.trim() || "";

    let completedCount = 0;
    let successCount = 0;
    const totalFiles = imageFiles.length;

    statusText.textContent = totalFiles > 1 ? `Uploading ${totalFiles} pasted images...` : 'Uploading pasted image...';

    imageFiles.forEach((file, index) => {
        const safeName = file.name && file.name !== 'image.png'
            ? file.name
            : `clipboard-image-${Date.now()}-${index + 1}.png`;
        const normalizedFile = new File([file], safeName, { type: file.type || 'image/png' });

        uploadFile(normalizedFile, tag, password, progressBar, statusText, null, (success) => {
            completedCount++;
            if (success) successCount++;
            if (completedCount >= totalFiles) {
                if (successCount === totalFiles) {
                    showMessage(`${totalFiles} pasted image(s) uploaded successfully!`, 'info');
                } else if (successCount > 0) {
                    showMessage(`${successCount}/${totalFiles} pasted image(s) uploaded. ${totalFiles - successCount} failed.`, 'error');
                }
                if (passwordInput) passwordInput.value = '';
            }
        });
    });
});


// Global variables
let selectedFile = null;
let selectedFiles = [];
let pendingFiles = []; // Files queued for upload with preview
let hasCalculated = false;
const uploadingImageUrls = new Set();
const uploadingImageKeys = new Set();

function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || '');
}

function getUploadErrorMessage(reason, fileName = '') {
    const nameText = fileName ? `\nFile: ${fileName}` : '';
    const details = reason ? `\nReason: ${reason}` : '';
    return `Photo upload failed.${nameText}${details}\n\nPlease check your browser/system upload permission and internet connection. Please try again.`;
}

function showUploadErrorPopup(reason, fileName = '') {
    const existingPopup = document.querySelector('.upload-error-popup');
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.className = 'upload-error-popup';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '10000';
    overlay.style.background = 'rgba(15, 23, 42, 0.55)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';

    const box = document.createElement('div');
    box.style.width = 'min(420px, 100%)';
    box.style.background = '#ffffff';
    box.style.color = '#111827';
    box.style.borderRadius = '8px';
    box.style.boxShadow = '0 18px 40px rgba(0,0,0,0.28)';
    box.style.padding = '22px';
    box.style.fontFamily = 'Poppins, Arial, sans-serif';
    box.style.textAlign = 'left';

    const title = document.createElement('h3');
    title.textContent = 'Photo Upload Failed';
    title.style.margin = '0 0 10px';
    title.style.fontSize = '20px';
    title.style.fontWeight = '700';
    title.style.color = '#dc2626';

    const message = document.createElement('p');
    message.textContent = getUploadErrorMessage(reason, fileName);
    message.style.margin = '0';
    message.style.whiteSpace = 'pre-line';
    message.style.lineHeight = '1.5';
    message.style.fontSize = '14px';

    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.textContent = 'OK';
    okButton.style.marginTop = '18px';
    okButton.style.width = '100%';
    okButton.style.padding = '10px 14px';
    okButton.style.border = '0';
    okButton.style.borderRadius = '6px';
    okButton.style.background = '#dc2626';
    okButton.style.color = '#ffffff';
    okButton.style.fontWeight = '700';
    okButton.style.cursor = 'pointer';
    okButton.onclick = () => overlay.remove();

    box.appendChild(title);
    box.appendChild(message);
    box.appendChild(okButton);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function reportUploadFailure(reason, fileName = '', statusText = null) {
    const message = getUploadErrorMessage(reason, fileName);
    if (statusText) statusText.textContent = 'Upload failed';
    showMessage(message, 'error');
    showUploadErrorPopup(reason, fileName);
}

function getCloudinaryErrorMessage(xhr) {
    try {
        const response = JSON.parse(xhr.responseText || '{}');
        if (response?.error?.message) return response.error.message;
    } catch (error) {
        // Keep fallback below when response is not JSON.
    }
    return xhr.status ? `Server returned status ${xhr.status}` : 'Upload request failed';
}

// Toggle password visibility
window.togglePasswordVisibility = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
};

// Expose functions to window object

// File Preview Logic - renders thumbnails with delete option
function renderFilePreview() {
    const container = document.getElementById('filePreviewContainer');
    container.innerHTML = '';

    if (pendingFiles.length === 0) {
        return;
    }

    pendingFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';

        const img = document.createElement('img');
        try {
            img.src = URL.createObjectURL(file);
        } catch (error) {
            reportUploadFailure('The browser or system did not allow the selected photo preview.', file.name);
            return;
        }
        img.alt = file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-preview-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove this file';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            pendingFiles.splice(index, 1);
            renderFilePreview();
            // Agar sab files remove ho gayi to file input bhi reset karo
            if (pendingFiles.length === 0) {
                document.getElementById('fileUpload').value = '';
            }
        };

        const nameLabel = document.createElement('div');
        nameLabel.className = 'file-preview-name';
        nameLabel.textContent = file.name;

        item.appendChild(img);
        item.appendChild(removeBtn);
        item.appendChild(nameLabel);
        container.appendChild(item);
    });
}

// Listen for file input changes to show preview
document.getElementById('fileUpload').addEventListener('change', function () {
    try {
        const selected = Array.from(this.files || []);
        const invalidFiles = selected.filter(file => !isImageFile(file));
        pendingFiles = selected.filter(isImageFile);

        if (invalidFiles.length) {
            reportUploadFailure('Only image files are allowed. Please select JPG, PNG, GIF, WebP, BMP, HEIC, or HEIF photos.', invalidFiles[0].name);
        }

        if (selected.length && !pendingFiles.length) {
            this.value = '';
        }

        renderFilePreview();
    } catch (error) {
        pendingFiles = [];
        this.value = '';
        renderFilePreview();
        reportUploadFailure('The browser or system blocked access to the selected photo.');
    }
});

// Multiple Image Upload Function
window.uploadImage = function () {
    const uploadBtn = document.querySelector(".colorful-upload-btn");

    const tagInput = document.getElementById("tagInput");
    const tag = tagInput.value.trim();
    const password = document.getElementById("passwordInput").value.trim();
    const progressBar = document.getElementById("progress");
    const statusText = document.getElementById("status");

    // Use pendingFiles instead of fileInput.files
    if (!pendingFiles.length) {
        reportUploadFailure('Please select at least one photo before upload.');
        return;
    }

    const invalidFiles = pendingFiles.filter(file => !isImageFile(file));
    if (invalidFiles.length) {
        reportUploadFailure('Only image files are allowed.', invalidFiles[0].name);
        return;
    }

    uploadBtn.style.display = "none"; // Upload button ko hide kar do

    if (!tag) {
        // Agar tag blank hai to modal open karo
        selectedFiles = [...pendingFiles];
        document.getElementById("tagModal").style.display = "flex";
        return;
    }

    // Reset progress bar to 0%
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    statusText.textContent = 'Ready';

    // Loop through all pending files
    let completedCount = 0;
    let successCount = 0;
    const totalFiles = pendingFiles.length;

    pendingFiles.forEach((file) => {
        uploadFile(file, tag, password, progressBar, statusText, null, (success) => {
            completedCount++;
            if (success) successCount++;
            if (completedCount >= totalFiles) {
                // Sab files complete hone par button wapas dikhao
                uploadBtn.style.display = "inline-block";
                if (successCount === totalFiles) {
                    showMessage(`${totalFiles} image(s) uploaded successfully!`, 'info');
                    document.getElementById('passwordInput').value = ''; // Clear password
                } else if (successCount > 0) {
                    showMessage(`${successCount}/${totalFiles} image(s) uploaded. ${totalFiles - successCount} failed.`, 'error');
                } else {
                    showMessage('Photo upload failed. Please try again.', 'error');
                }
            }
        });
    });

    // Clear preview and reset
    pendingFiles = [];
    renderFilePreview();
    document.getElementById('fileUpload').value = '';
};


window.closeModal = function () {
    document.getElementById('tagModal').style.display = 'none';
    document.getElementById('modalTagInput').value = '';
    document.getElementById('modalTagInput').style.display = 'inline-block'; // Re-show input field
    document.getElementById('modalPasswordInput').value = ''; // Clear modal password
    const pwWrapper = document.querySelector('#tagModal .password-field-wrapper');
    if (pwWrapper) pwWrapper.style.display = 'inline-flex'; // Re-show password field
    document.getElementById('modalProgressContainer').style.display = 'none';
    document.getElementById('modalProgress').style.width = '0%';
    document.getElementById('modalProgress').textContent = '0%';
    // Reset modal heading back to default
    const modalHeading = document.getElementById('modalHeading');
    if (modalHeading) modalHeading.textContent = 'Tag is required!';
    const modalStatus = document.getElementById('modalStatus');
    if (modalStatus) modalStatus.textContent = 'Uploading...';
    document.querySelector('.modal-content .upload-btn').style.display = 'inline-block'; // Show buttons again
    document.querySelector('.modal-content .cancel-btn').style.display = 'inline-block'; // Show buttons again
    // Re-show the main upload button that was hidden
    const uploadBtn = document.querySelector(".colorful-upload-btn");
    if (uploadBtn) uploadBtn.style.display = "inline-block";
    // Reset main progress bar
    document.getElementById('progress').style.width = '0%';
    document.getElementById('progress').textContent = '0%';
    document.getElementById('status').textContent = 'Ready';
    selectedFile = null; // Clear selected file
    selectedFiles = []; // Clear selected files
    pendingFiles = []; // Clear pending files
    renderFilePreview(); // Clear file preview
    document.getElementById('fileUpload').value = ''; // Reset file input
};

window.submitTag = function () {
    const modalTagInput = document.getElementById('modalTagInput');
    const tag = modalTagInput.value.trim();
    const password = document.getElementById('modalPasswordInput').value.trim();
    const progressBar = document.getElementById('progress');
    const statusText = document.getElementById('status');
    const modalProgress = document.getElementById('modalProgress');
    const modalProgressContainer = document.getElementById('modalProgressContainer');

    if (!tag) {
        showMessage("Tag is required!", "error");
        return;
    }

    // Reset progress bars
    modalProgress.style.width = '0%';
    modalProgress.textContent = '0%';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    statusText.textContent = 'Uploading...';

    // Change modal heading to uploading state
    const modalHeading = document.getElementById('modalHeading');
    if (modalHeading) modalHeading.textContent = 'Uploading...';
    const modalStatus = document.getElementById('modalStatus');
    if (modalStatus) modalStatus.textContent = 'Starting upload...';

    modalProgressContainer.style.display = 'block';
    document.querySelector('.modal-content .upload-btn').style.display = 'none';
    document.querySelector('.modal-content .cancel-btn').style.display = 'none';
    // Input fields bhi hide karo uploading ke dauran
    modalTagInput.style.display = 'none';
    document.querySelector('#tagModal .password-field-wrapper').style.display = 'none';

    // Multiple files handle
    const filesToUpload = selectedFiles.length > 0 ? selectedFiles : (selectedFile ? [selectedFile] : []);

    if (filesToUpload.length === 0) {
        reportUploadFailure('No files to upload. Please select a photo again.');
        document.querySelector('.modal-content .upload-btn').style.display = 'inline-block';
        document.querySelector('.modal-content .cancel-btn').style.display = 'inline-block';
        return;
    }

    let completedCount = 0;
    let successCount = 0;
    const totalFiles = filesToUpload.length;

    filesToUpload.forEach((file) => {
        uploadFile(file, tag, password, progressBar, statusText, modalProgress, (success) => {
            completedCount++;
            if (success) successCount++;
            if (completedCount >= totalFiles) {
                // Close modal after all files are uploaded
                setTimeout(() => {
                    closeModal();
                    if (successCount === totalFiles) {
                        showMessage(`${totalFiles} image(s) uploaded successfully!`, 'info');
                    } else if (successCount > 0) {
                        showMessage(`${successCount}/${totalFiles} image(s) uploaded. ${totalFiles - successCount} failed.`, 'error');
                    } else {
                        showMessage('Photo upload failed. Please try again.', 'error');
                    }
                }, 800);
            }
        });
    });

selectedFiles = [];
selectedFile = null;
};

function setUploadProgress(progressBar, statusText, modalProgress, percent, label = 'Uploading') {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    const progressText = `${safePercent}%`;
    progressBar.style.width = progressText;
    progressBar.textContent = progressText;
    statusText.textContent = `${label}... ${progressText}`;

    if (modalProgress) {
        modalProgress.style.width = progressText;
        modalProgress.textContent = progressText;
    }

    const modalStatus = document.getElementById('modalStatus');
    if (modalStatus) modalStatus.textContent = `${label}... ${progressText}`;
}

function createUploadProgressAnimator(progressBar, statusText, modalProgress) {
    let currentPercent = 1;
    let targetPercent = 1;
    let currentLabel = 'Preparing upload';
    let timerId = null;

    const render = () => {
        setUploadProgress(progressBar, statusText, modalProgress, currentPercent, currentLabel);
    };

    const step = () => {
        if (currentPercent >= targetPercent) return;

        const gap = targetPercent - currentPercent;
        const increment = gap > 30 ? 2 : 1;
        currentPercent = Math.min(targetPercent, currentPercent + increment);
        render();
    };

    const start = () => {
        if (timerId) return;
        render();
        timerId = setInterval(step, 90);
    };

    const moveTo = (percent, label = currentLabel) => {
        currentLabel = label;
        targetPercent = Math.max(targetPercent, Math.min(100, Math.round(percent)));
        start();
    };

    const finish = (label = 'Complete') => {
        currentLabel = label;
        targetPercent = 100;
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => {
            if (currentPercent >= 100) {
                clearInterval(timerId);
                timerId = null;
                render();
                return;
            }

            currentPercent = Math.min(100, currentPercent + 1);
            render();
        }, 45);
    };

    const stop = () => {
        if (timerId) clearInterval(timerId);
        timerId = null;
    };

    start();
    return { moveTo, finish, stop };
}

function waitForGalleryImageRendered({ imageUrl, imageKey }, timeoutMs = 12000) {
    return new Promise((resolve) => {
        const gallery = document.getElementById('gallery');
        if (!gallery) {
            resolve(false);
            return;
        }

        let settled = false;
        let observer = null;
        let timeoutId = null;

        const finish = (didRender) => {
            if (settled) return;
            settled = true;
            if (observer) observer.disconnect();
            if (timeoutId) clearTimeout(timeoutId);
            resolve(didRender);
        };

        const imageMatches = (img) => {
            if (imageKey && img.closest(`[data-image-key="${imageKey}"]`)) {
                return true;
            }

            const src = img.currentSrc || img.src || '';
            return src === imageUrl || src.startsWith(imageUrl);
        };

        const resolveAfterPaint = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => finish(true));
            });
        };

        const watchImage = (img) => {
            if (img.complete && img.naturalWidth > 0) {
                resolveAfterPaint();
                return true;
            }

            img.addEventListener('load', resolveAfterPaint, { once: true });
            img.addEventListener('error', () => finish(false), { once: true });
            return false;
        };

        const scanGallery = () => {
            const galleryImages = Array.from(gallery.querySelectorAll('.image-container img'));
            const img = galleryImages.find(imageMatches) || galleryImages[0];
            if (!img) return false;
            return watchImage(img);
        };

        if (scanGallery()) return;

        observer = new MutationObserver(scanGallery);
        observer.observe(gallery, { childList: true, subtree: true });
        timeoutId = setTimeout(() => {
            const renderedImage = Array.from(gallery.querySelectorAll('.image-container img'))
                .some(img => img.complete && img.naturalWidth > 0);
            finish(renderedImage);
        }, timeoutMs);
    });
}

function uploadFile(file, tag, password, progressBar, statusText, modalProgress, onComplete) {
    if (!isImageFile(file)) {
        reportUploadFailure('Selected file is not a valid image.', file?.name || '', statusText);
        if (onComplete) onComplete(false);
        return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const maxAttempts = 3;
    const retryDelays = [1200, 2500];

    const createFormData = () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('tags', tag);
        return formData;
    };

    let formData = null;
    try {
        formData = createFormData();
    } catch (error) {
        reportUploadFailure('The browser or system blocked access to the selected photo.', file?.name || '', statusText);
        if (onComplete) onComplete(false);
        return;
    }

    const progressAnimator = createUploadProgressAnimator(progressBar, statusText, modalProgress);
    progressAnimator.moveTo(8, 'Preparing upload');

    const shouldRetryStatus = (status) => status === 0 || status === 408 || status === 429 || status >= 500;

    const retryUpload = (attempt, reason) => {
        if (attempt >= maxAttempts) return false;
        const nextAttempt = attempt + 1;
        const delay = retryDelays[attempt - 1] || 2500;
        console.warn(`Upload attempt ${attempt} failed. Retrying...`, reason || '');
        progressAnimator.moveTo(Math.min(20 + attempt * 8, 45), `Retrying upload ${nextAttempt}/${maxAttempts}`);
        setTimeout(() => {
            try {
                formData = createFormData();
                startUploadAttempt(nextAttempt);
            } catch (error) {
                progressAnimator.stop();
                reportUploadFailure('The browser or system blocked access to the selected photo.', file?.name || '', statusText);
                if (onComplete) onComplete(false);
            }
        }, delay);
        return true;
    };

    function startUploadAttempt(attempt) {
        const xhr = new XMLHttpRequest();
        xhr.timeout = attempt === 1 ? 60000 : 90000;

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const uploadPercent = Math.min(88, (event.loaded / event.total) * 88);
                if (event.loaded >= event.total) {
                    progressAnimator.moveTo(91, 'Processing image');
                } else {
                    progressAnimator.moveTo(uploadPercent, attempt > 1 ? `Uploading retry ${attempt}` : 'Uploading');
                }
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                let data = null;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (error) {
                    progressAnimator.stop();
                    reportUploadFailure('The upload server response could not be read.', file.name, statusText);
                    if (onComplete) onComplete(false);
                    return;
                }

                if (!data.secure_url) {
                    progressAnimator.stop();
                    reportUploadFailure('Upload completed, but the image URL was not received.', file.name, statusText);
                    if (onComplete) onComplete(false);
                    return;
                }

                const imgObj = {
                    url: data.secure_url,
                    tag: tag,
                    name: file.name,
                    timestamp: Date.now()
                };
                if (password) {
                    imgObj.password = password;
                }

                progressAnimator.moveTo(92, 'Processing image');
                uploadingImageUrls.add(data.secure_url);

                push(imagesRef, imgObj)
                    .then(async (newImageRef) => {
                        const imageKey = newImageRef.key;
                        if (imageKey) uploadingImageKeys.add(imageKey);
                        progressAnimator.moveTo(96, 'Adding to gallery');
                        document.getElementById('fileUpload').value = '';
                        document.getElementById('tagInput').value = '';
                        const didRender = await waitForGalleryImageRendered({ imageUrl: data.secure_url, imageKey });
                        uploadingImageUrls.delete(data.secure_url);
                        if (imageKey) uploadingImageKeys.delete(imageKey);
                        if (didRender) {
                            progressAnimator.finish('Complete');
                        } else {
                            progressAnimator.moveTo(99, 'Preview loading');
                        }
                        statusText.textContent = didRender ? 'Complete' : 'Uploaded, preview loading';
                        const modalStatus = document.getElementById('modalStatus');
                        if (modalStatus) modalStatus.textContent = statusText.textContent;
                        if (onComplete) onComplete(true);
                    })
                    .catch((error) => {
                        progressAnimator.stop();
                        uploadingImageUrls.delete(data.secure_url);
                        console.error("Firebase Push Error:", error);
                        reportUploadFailure(error?.message || 'The image could not be saved to the database.', file.name, statusText);
                        if (onComplete) onComplete(false);
                    });
                return;
            }

            console.error("Cloudinary Upload Failed:", xhr.status, xhr.responseText);
            if (shouldRetryStatus(xhr.status) && retryUpload(attempt, xhr.status)) return;

            progressAnimator.stop();
            reportUploadFailure(getCloudinaryErrorMessage(xhr), file.name, statusText);
            if (onComplete) onComplete(false);
        };

        xhr.onerror = function () {
            console.error("Upload error occurred:", xhr.status);
            if (retryUpload(attempt, 'network error')) return;
            progressAnimator.stop();
            reportUploadFailure('Network issue tha. Auto retry ke baad bhi upload nahi hua. Please try again.', file.name, statusText);
            if (onComplete) onComplete(false);
        };

        xhr.ontimeout = function () {
            if (retryUpload(attempt, 'timeout')) return;
            progressAnimator.stop();
            reportUploadFailure('Upload timed out. Auto retry ke baad bhi complete nahi hua.', file.name, statusText);
            if (onComplete) onComplete(false);
        };

        xhr.onabort = function () {
            progressAnimator.stop();
            reportUploadFailure('The upload was cancelled or the browser aborted the request.', file.name, statusText);
            if (onComplete) onComplete(false);
        };

        try {
            xhr.open('POST', url, true);
            xhr.send(formData);
        } catch (error) {
            if (retryUpload(attempt, error?.message)) return;
            progressAnimator.stop();
            reportUploadFailure(error?.message || 'The browser or system did not allow the photo upload to start.', file.name, statusText);
            if (onComplete) onComplete(false);
        }
    }

    startUploadAttempt(1);
}

// Custom message box function (instead of alert)
function showMessage(message, type = "info") {
    const messageBox = document.createElement("div");
    messageBox.style.position = "fixed";
    messageBox.style.top = "20px";
    messageBox.style.left = "50%";
    messageBox.style.transform = "translateX(-50%)";
    messageBox.style.padding = "15px 25px";
    messageBox.style.borderRadius = "10px";
    messageBox.style.zIndex = "9999";
    messageBox.style.color = "white";
    messageBox.style.fontWeight = "bold";
    messageBox.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
    messageBox.style.transition = "opacity 0.5s ease-in-out";
    messageBox.style.opacity = "1";

    if (type === "error") {
        messageBox.style.backgroundColor = "#f44336"; /* Red */
    } else {
        messageBox.style.backgroundColor = "#4CAF50"; /* Green */
    }

    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    setTimeout(() => {
        messageBox.style.opacity = "0";
        messageBox.addEventListener("transitionend", () => messageBox.remove());
    }, 3000);
}

// Function to handle direct image download
window.downloadImageDirectly = async function (imageUrl, fileName) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showMessage('Download initiated!', 'info');
    } catch (error) {
        console.error("Error downloading image:", error);
        showMessage('Failed to download image.', 'error');
    }
};


function loadImages() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    // Clear the gallery first to avoid duplicates when data updates
    // The onValue listener will handle re-rendering on changes
    onValue(imagesRef, (snapshot) => {
        gallery.innerHTML = ''; // Clear content every time data changes
        const images = snapshot.val();
        const now = Date.now();

        if (images) {
            const sortedImages = Object.entries(images)
                .map(([key, img]) => ({ key, ...img }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Sort by timestamp descending

            sortedImages.forEach(({ key, url, tag, timestamp, name, password: imgPassword }) => {
                // Check if the image is older than 5 minutes (300,000 milliseconds)
                // If it is, delete it from the database (cleanup logic)
                if (now - (timestamp || 0) > 300000) {
                    remove(dbRef(db, `images/${key}`))
                        .then(() => console.log(`Image ${key} deleted (older than 5 min)`))
                        .catch((error) => console.error("Auto-delete error:", error));
                } else {
                    const isLocked = !!imgPassword;
                    const container = document.createElement('div');
                    container.className = 'image-container' + (isLocked ? ' image-locked' : '');
                    container.dataset.imageKey = key;

                    const imgElement = document.createElement('img');
                    imgElement.src = url;
                    imgElement.alt = tag || 'Uploaded image';
                    imgElement.loading = uploadingImageUrls.has(url) || uploadingImageKeys.has(key) ? 'eager' : 'lazy';
                    imgElement.decoding = 'async';
                    imgElement.onerror = () => {
                        imgElement.src = `https://placehold.co/150x150/cccccc/333333?text=Image+Error`;
                        console.warn(`Failed to load image: ${url}`);
                    };

                    // Lock overlay for password protected images
                    if (isLocked) {
                        const lockOverlay = document.createElement('div');
                        lockOverlay.className = 'lock-overlay';
                        lockOverlay.innerHTML = '<span class="lock-icon">Locked</span><span class="lock-text">Tap to unlock</span>';
                        container.appendChild(lockOverlay);
                    }

                    const tagElement = document.createElement('p');
                    tagElement.className = 'tag';
                    tagElement.textContent = `Tag: ${tag || 'No tag'}` + (isLocked ? ' Locked' : '');

                    // Shared unlock function
                    const unlockImage = () => {
                        if (!container.classList.contains('image-locked')) return; // Already unlocked
                        const enteredPw = prompt('Enter password to unlock this image:');
                        if (enteredPw === null) return; // Cancelled
                        if (enteredPw === imgPassword) {
                            container.classList.remove('image-locked');
                            container.classList.add('image-unlocked');
                            container.style.cursor = 'default';
                            const overlay = container.querySelector('.lock-overlay');
                            if (overlay) overlay.remove();
                            tagElement.textContent = `Tag: ${tag || 'No tag'}`;
                            const unlockBtnEl = container.querySelector('.unlock-btn');
                            if (unlockBtnEl) unlockBtnEl.style.display = 'none';
                            showMessage('Image unlocked!', 'info');
                        } else {
                            showMessage('Wrong password!', 'error');
                        }
                    };

                    // Click container to unlock locked images
                    if (isLocked) {
                        container.style.cursor = 'pointer';
                        container.onclick = (e) => {
                            // Agar button par click kiya hai to ignore karo (button apna kaam karega)
                            if (e.target.closest('.download-btn') || e.target.closest('.delete-btn') || e.target.closest('.unlock-btn')) {
                                return;
                            }
                            unlockImage();
                        };
                    }

                    // Download Button
                    const downloadBtn = document.createElement('button');
                    downloadBtn.className = 'download-btn';
                    downloadBtn.textContent = 'Download';
                    downloadBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (isLocked && container.classList.contains('image-locked')) {
                            unlockImage();
                            return;
                        }
                        window.downloadImageDirectly(url, name || `image_${key}.jpg`);
                    };

                    // Delete Button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        // Agar password protected hai to pehle password maango
                        if (isLocked && imgPassword) {
                            const pw = prompt('Enter password to delete this image:');
                            if (pw === null) return;
                            if (pw !== imgPassword) {
                                showMessage('Wrong password! Cannot delete.', 'error');
                                return;
                            }
                        }
                        if (confirm('Are you sure you want to delete this image?')) {
                            remove(dbRef(db, `images/${key}`))
                                .then(() => {
                                    showMessage('Image deleted successfully!', 'info');
                                })
                                .catch((error) => {
                                    console.error("Delete error:", error);
                                    showMessage('Failed to delete image.', 'error');
                                });
                        }
                    };

                    // Button group
                    const btnGroup = document.createElement('div');
                    btnGroup.className = 'gallery-btn-group';

                    // Unlock button (only for locked images)
                    if (isLocked) {
                        const unlockBtn = document.createElement('button');
                        unlockBtn.className = 'unlock-btn';
                        unlockBtn.textContent = 'Unlock';
                        unlockBtn.onclick = (e) => {
                            e.stopPropagation();
                            unlockImage();
                        };
                        btnGroup.appendChild(unlockBtn);
                    }

                    btnGroup.appendChild(downloadBtn);
                    btnGroup.appendChild(deleteBtn);

                    container.appendChild(imgElement);
                    container.appendChild(tagElement);
                    container.appendChild(btnGroup);
                    gallery.appendChild(container);
                }
            });
        } else {
            gallery.innerHTML = '<p style="color: #455a64; margin-top: 20px;">No images uploaded yet.</p>';
        }
    });
}

// #endregion


// #region FIREBASE & IMAGE UPLOAD

function hideAllMainContent() {
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) uploadSection.style.display = 'none';
    const uploadedHeading = document.querySelector('[data-uploaded-heading="true"]');
    if (uploadedHeading) uploadedHeading.style.display = 'none';
    const gallery = document.getElementById('gallery');
    if (gallery) gallery.style.display = 'none';
}

function showAllMainContent() {
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) uploadSection.style.display = 'block';
    const uploadedHeading = document.querySelector('[data-uploaded-heading="true"]');
    if (uploadedHeading) uploadedHeading.style.display = 'block';
    const gallery = document.getElementById('gallery');
    if (gallery) gallery.style.display = 'grid';
}

window.openCSATModal = function () {
    document.getElementById('csatModal').style.display = 'flex';
    hideAllMainContent();
    calculateCSAT();
};

window.closeCSATModal = function () {
    document.getElementById('csatModal').style.display = 'none';
    document.getElementById('goodCount').value = '0';
    document.getElementById('badCount').value = '0';
    document.getElementById('requiredCSAT').value = '70';
    document.getElementById('calculateButton').textContent = 'Calculate';
    hasCalculated = false;
    calculateCSAT();
    showAllMainContent();
};

window.calculateCSAT = function () {
    const goodCount = parseInt(document.getElementById('goodCount').value) || 0;
    const badCount = parseInt(document.getElementById('badCount').value) || 0;
    const requiredCSAT = parseInt(document.getElementById('requiredCSAT').value);
    const resultSection = document.getElementById('csatResult');
    const status = document.getElementById('csatStatus');
    const calculateButton = document.getElementById('calculateButton');

    const total = goodCount + badCount;
    const csat = total === 0 ? 0 : (goodCount / total) * 100;
    const formattedCSAT = csat.toFixed(2);

    resultSection.querySelector('p:nth-child(1)').textContent = `Total: ${total}`;
    resultSection.querySelector('p:nth-child(2)').textContent = `CSAT: ${formattedCSAT}%`;

    if (total === 0) {
        status.innerHTML = '<span class="shivang-rainbow">SHIVANG</span>';
        status.className = '';
        return;
    }

    let additionalGoodNeeded = 0;
    let newCSAT = csat;
    let newGoodCount = goodCount;
    let newTotal = total;

    if (csat <= requiredCSAT) {
        while (newCSAT <= requiredCSAT) {
            additionalGoodNeeded++;
            newGoodCount = goodCount + additionalGoodNeeded;
            newTotal = total + additionalGoodNeeded;
            newCSAT = (newGoodCount / newTotal) * 100;
        }
    }

    const isAboveRequired = csat > requiredCSAT;

    if (isAboveRequired) {
        status.textContent = `Success! CSAT (${formattedCSAT}%) is above required (${requiredCSAT}%+).`;
        status.className = 'success';
    } else {
        status.textContent = `Need ${additionalGoodNeeded} more good count(s) to achieve ${requiredCSAT}%+ (exact: ${newCSAT.toFixed(2)}%).`;
        status.className = 'error';
    }

    if (!hasCalculated) {
        hasCalculated = true;
        calculateButton.textContent = 'Recalculate';
    }
};

const csatModal = document.getElementById('csatModal');
if (csatModal) {
    csatModal.addEventListener('click', function (event) {
        if (event.target === this) closeCSATModal();
    });
}
// #endregion

loadImages();
