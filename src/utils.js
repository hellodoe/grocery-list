// Toast DOM Elements
const toastContainer = document.getElementById('toast-container');

// Confirm Modal DOM Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCloseBtn = document.getElementById('confirm-close-btn');

// Show Custom Toast Notification
export function showToast(message, type = 'success', duration = 3500) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Trigger show class on next tick
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Click to close
    toast.addEventListener('click', () => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    });

    // Auto dismiss
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            toast.classList.add('hide');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }
    }, duration);
}

// Show Custom Promise-based Confirmation Modal
export function showConfirm(title, message, confirmText = 'Confirmă', cancelText = 'Anulează') {
    return new Promise((resolve) => {
        if (!confirmModal) return resolve(false);

        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmOkBtn.textContent = confirmText;
        confirmCancelBtn.textContent = cancelText;

        confirmModal.style.display = 'flex';

        function cleanup(result) {
            confirmModal.style.display = 'none';
            confirmOkBtn.removeEventListener('click', onConfirm);
            confirmCancelBtn.removeEventListener('click', onCancel);
            confirmCloseBtn.removeEventListener('click', onCancel);
            resolve(result);
        }

        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }

        confirmOkBtn.addEventListener('click', onConfirm);
        confirmCancelBtn.addEventListener('click', onCancel);
        confirmCloseBtn.addEventListener('click', onCancel);
    });
}
