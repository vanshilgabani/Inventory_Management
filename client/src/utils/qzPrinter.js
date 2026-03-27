import qz from 'qz-tray';
import { KJUR, KEYUTIL, hex2b64 } from 'jsrsasign';

// Load your certificate
const CERT = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZ0PEYw1MA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDMyMDA2MjUwMVoXDTQ2MDMyMDA2MjUwMVowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDi
PmMeqHfc8B6K88l8tmReGeQKd9SpMgh1IOGtLvRRjn9xJMBDpI2LQ2fot/OYVP5T
XHMY1Y5G/bQvsybT2b5i4Vr/bAVJUT90xOCtSCc0CASRttZ8JjVLESHMKdSn7f8A
9yL6ww3FFHFRXTPWrPyHLQJsEKN//XJiC1tMtTsu5Q/6Y2rulil5CPbWO9n65vf0
EUE1UW+GPWFylMVtffr4dsVwA925vrVq9U21YRDqdTwMQJapg29v+U4G3rYOhAIK
CUmYAwBod9NCw9cKIOk2CILaTwSLeYw16ac+/NrDkE1PY7tn8IuUjCYhdl7aG6I+
qWQrF1aCWshfMS3vqpmxAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBSXWx7eE44oGzOoriv09NThyVeEjzANBgkq
hkiG9w0BAQsFAAOCAQEAqW2LCNn7FonvdTeiV2Fu/nKk7gXcgaAGjQpZfFuIYf4x
qboi7HwpjYeGfKdTPq2qy0EZSB+/FOGgNDo9c4/HOrlGBG3EmpT4pcRkWvE113sX
vC7mWmfbslVUS5/nynwnbM4udXs+EebecnaRRouXZ4KxZGEX9N7DVm8rON0aEc+n
mA2MPXDWznl6RJInFvFu6tt3ukpkduE+4JFtu4t3AQCBXv+CAjkuoZkYPc5wqyIH
STF7Y6cjTfsUYUcHK3H+JOY0ZTS6aHlnLsbOAtk4rxMArRaPrFPfr7ok5+qXXT9t
kNAROm07lx3N1+99uuTWpbbXFFb4Etxldy2AviUF+Q==
-----END CERTIFICATE-----`;

// Load your private key  
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDiPmMeqHfc8B6K
88l8tmReGeQKd9SpMgh1IOGtLvRRjn9xJMBDpI2LQ2fot/OYVP5TXHMY1Y5G/bQv
sybT2b5i4Vr/bAVJUT90xOCtSCc0CASRttZ8JjVLESHMKdSn7f8A9yL6ww3FFHFR
XTPWrPyHLQJsEKN//XJiC1tMtTsu5Q/6Y2rulil5CPbWO9n65vf0EUE1UW+GPWFy
lMVtffr4dsVwA925vrVq9U21YRDqdTwMQJapg29v+U4G3rYOhAIKCUmYAwBod9NC
w9cKIOk2CILaTwSLeYw16ac+/NrDkE1PY7tn8IuUjCYhdl7aG6I+qWQrF1aCWshf
MS3vqpmxAgMBAAECggEAPKvsWuFk23wNRMghxW8INXAOBnyiLAl92SNLQe0wmdpz
9LydTsaHKsyVxgPmsHhCh8poF0XV1NXeh1gs1m0zMEMs6whl1oaSVNcjRXTvBnYL
+6Ojm0GH0yyx+pVRMQOS+ghMeiDqxWo5BU/QQga75eg9GQvRPNaT4RUYk9aaG3XT
CdvPNqGazLIcvxcdPCYmKZ+0pNw7r6fQEZ2y09dJMvls31CqjPnGtXE8tl7X4nLb
OOw0Aqn38vBs/psPCdfdc3U8xb6US90JCyf7UocdwOXKk4j1NS1j/C47h23PQ7bx
kUNU/RTGoegm6lCgG+dM7qnNVTYLl0itEetTVGjWPQKBgQD6C8B7LtzVCB6JMF8a
eYIaqcjdIntSPVGSCpwKQSE+Jy5+bRB45dfCyN7CqF89pK4WaZlwuPw+fjbRMwFQ
FZW+Jk7tyH6IdjKc5uwPzOkKhEYeh+eusnflgqtAvukrYuIHSIoRjfg64eG6EVWO
oveN751nlkh0sBHSCBLgfHeKTwKBgQDnoYpCquWiP8Gbhz8M3MbCSa/++e4YzNMr
FEcmGHLc6uFp24bkgVYiwasSZ7eMfc2XDPNQx9DmyhrvKCTOh5QRPQXheEaTjq1C
eZnk8leEnfwysLYvha3sL9qcqYM8sNXRB0noEm6JyYmmoG1WcwQySVOBqErI3WUk
gZ3aygab/wKBgEEAfxhG1Xe39aA6Z+7M+aqOyr3Z8e8uK59ojKoJxmeO7gJFvgt/
zLhBWc+Gz8OJpQwEhbQNEt34F64IsWWtRtE4yjn8bhBxkbTCP0nYPhjSzBuxvuPm
V07dykE5oAn8WcAE9oebvZUpFXI2gWRkLzDBwsyj/8/92ZQdLzMWiEj3AoGBALph
c50dYlVhs+nvs74n0A75uBIVDY8LEUfysyVmOtakcOj66dnocGTbLUpMBpeXitxm
YUq43dE3AuE5jhRZZ71POvIoE7Ib9jItIrXkgqOFdC9dndszV7Va9C9m/uDQ8duW
X9PLMQLSFl7ra89KETBdbEJCJprl+sKbQWeRdCwFAoGBAI99E0dcfn4OUr6hGYUz
1nvxRTUszPi4rhT72mLlyzp7QbNGluXx7Pk8ISk94gCTQAfZ/VldN8Yr/TX7JahU
7rUD0W5NrqSDRNu5L5gNWWBwlxeA0YJrWkY70EmH8V+HhwelLl2yz47ws6QRry4N
xGPereXPNwbPqPzRRlsWtBHc
-----END PRIVATE KEY-----`;

qz.security.setCertificatePromise((resolve) => resolve(CERT));

qz.security.setSignaturePromise((toSign) => {
  return (resolve, reject) => {
    try {
      const pk = KEYUTIL.getKey(PRIVATE_KEY); // ← fix: use KEYUTIL directly, not KJUR.KEYUTIL
      const sig = new KJUR.crypto.Signature({ alg: 'SHA512withRSA' });
      sig.init(pk);
      sig.updateString(toSign);
      resolve(hex2b64(sig.sign()));
    } catch (e) {
      reject(e);
    }
  };
});

// ─── ADD EVERYTHING BELOW THIS LINE ──────────────────────────────────────────

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
export const savePrinter     = (name) => localStorage.setItem(PRINTER_KEY, name);
export const clearPrinter    = () => localStorage.removeItem(PRINTER_KEY);

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