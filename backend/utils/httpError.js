export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg);
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);
