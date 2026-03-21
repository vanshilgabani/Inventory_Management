import qz from 'qz-tray';

// Allow unsigned connections — fine for internal private use
qz.security.setCertificatePromise((resolve) => resolve(''));
qz.security.setSignaturePromise(() => (resolve) => resolve(''));

const PRINTER_KEY = 'qz_challan_printer';

export const connectQZ = async () => {
  try {
    if (qz.websocket.isActive()) return true;
    await qz.websocket.connect({ retries: 1, delay: 500 });
    return true;
  } catch {
    return false;
  }
};

export const getAvailablePrinters = async () => {
  try {
    await connectQZ();
    const printers = await qz.printers.find();
    return Array.isArray(printers) ? printers : [printers];
  } catch {
    return [];
  }
};

export const getSavedPrinter = () => localStorage.getItem(PRINTER_KEY);
export const savePrinter    = (name) => localStorage.setItem(PRINTER_KEY, name);
export const clearPrinter   = () => localStorage.removeItem(PRINTER_KEY);

export const printBase64PDF = async (base64, printerName) => {
  try {
    await connectQZ();
    const config = qz.configs.create(printerName);
    await qz.print(config, [{
      type: 'pixel',
      format: 'pdf',
      flavor: 'base64',
      data: base64
    }]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Fallback: open PDF blob in hidden iframe and trigger browser print dialog
export const printViaIframe = (base64) => {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob   = new Blob([bytes], { type: 'application/pdf' });
  const url    = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 2000);
  };
};
