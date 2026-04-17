import { useEffect, useState } from "react";

import QRCode from "qrcode";

export default function PosQrCode({
  value,
  alt = "QR code",
  size = 180,
  imageClassName = "",
}) {
  const [qrSrc, setQrSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setQrSrc("");
      setError("");
      return undefined;
    }

    setError("");

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0b1720",
        light: "#ffffff",
      },
    })
      .then((nextQrSrc) => {
        if (!cancelled) {
          setQrSrc(nextQrSrc);
        }
      })
      .catch((generationError) => {
        console.error("Failed to generate guest QR code:", generationError);

        if (!cancelled) {
          setQrSrc("");
          setError("Unable to generate QR code.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!value) {
    return <p className="text-sm text-pos-muted">QR link not ready.</p>;
  }

  if (error) {
    return <p className="text-sm text-pos-muted">{error}</p>;
  }

  if (!qrSrc) {
    return <p className="text-sm text-pos-muted">Preparing QR...</p>;
  }

  return <img src={qrSrc} alt={alt} className={imageClassName} />;
}
