export const Methods = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
  HEAD: "HEAD",
  OPTIONS: "OPTIONS",
} as const;

export type HttpMethod = keyof typeof Methods;

export const Uploads = {
  UPLOAD: "UPLOAD",
  RELATED: "RELATED",
};

export type HttpUpload = keyof typeof Uploads;