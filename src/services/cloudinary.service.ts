/**
 * Cloudinary Storage Service
 * Works natively in Cloudflare Workers using standard Web Crypto APIs.
 */

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Generates SHA-1 signature for Cloudinary signed upload.
 * Parameters must be sorted alphabetically.
 */
async function generateSignature(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signatureString = paramString + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads a file to Cloudinary.
 */
export async function uploadToCloudinary(
  file: File,
  env: {
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
  },
): Promise<UploadResult> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary configuration is missing in environment variables",
    );
  }

  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = "siris_reports";

  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = await generateSignature(paramsToSign, apiSecret);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  formData.append("timestamp", timestamp);
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Cloudinary upload failed: ${response.statusText} - ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    secure_url: string;
    public_id: string;
  };

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}
