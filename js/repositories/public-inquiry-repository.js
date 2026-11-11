import { toPublicRentalApplication } from "../models/public-inquiry-models.js";

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export class PublicInquiryRepository {
  saveRental() { throw new Error("saveRental must be implemented by an adapter."); }
  getRentalById() { throw new Error("getRentalById must be implemented by an adapter."); }
  getLatestRental() { throw new Error("getLatestRental must be implemented by an adapter."); }
  lookupRental() { throw new Error("lookupRental must be implemented by an adapter."); }
  saveContact() { throw new Error("saveContact must be implemented by an adapter."); }
}

export class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

export class LocalPublicInquiryRepository extends PublicInquiryRepository {
  constructor({ storage, namespace = "nxspace.beta.v1" } = {}) {
    super();
    this.storage = storage || globalThis.localStorage || new MemoryStorage();
    this.rentalKey = `${namespace}.rentals`;
    this.contactKey = `${namespace}.contacts`;
    this.latestRentalKey = `${namespace}.latest-rental`;
  }

  readCollection(key) {
    try {
      const parsed = JSON.parse(this.storage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      throw new Error("Local persistence data is unavailable.", { cause: error });
    }
  }

  writeCollection(key, records) {
    try {
      this.storage.setItem(key, JSON.stringify(records));
    } catch (error) {
      throw new Error("Unable to save local persistence data.", { cause: error });
    }
  }

  saveRental(record) {
    const records = this.readCollection(this.rentalKey);
    const duplicate = records.find((item) => (
      item.fingerprint === record.fingerprint
      && Date.now() - new Date(item.createdAt).getTime() <= DUPLICATE_WINDOW_MS
    ));

    if (duplicate) {
      this.storage.setItem(this.latestRentalKey, duplicate.id);
      return { record: duplicate, duplicate: true };
    }

    records.unshift(record);
    this.writeCollection(this.rentalKey, records);
    this.storage.setItem(this.latestRentalKey, record.id);
    return { record, duplicate: false };
  }

  getRentalById(id = "") {
    return this.readCollection(this.rentalKey).find((record) => record.id === id) || null;
  }

  getLatestRental() {
    const id = this.storage.getItem(this.latestRentalKey);
    return id ? this.getRentalById(id) : null;
  }

  lookupRental(id = "", verifier = "") {
    const record = this.getRentalById(String(id).trim().toUpperCase());

    if (!record) {
      return null;
    }

    const normalizedVerifier = String(verifier).trim().toLowerCase();
    const phoneDigits = record.phone.replace(/\D/g, "");
    const matches = normalizedVerifier === record.email.toLowerCase()
      || normalizedVerifier === phoneDigits.slice(-4);

    return matches ? toPublicRentalApplication(record) : null;
  }

  saveContact(record) {
    const records = this.readCollection(this.contactKey);
    const duplicate = records.find((item) => (
      item.fingerprint === record.fingerprint
      && Date.now() - new Date(item.createdAt).getTime() <= DUPLICATE_WINDOW_MS
    ));

    if (duplicate) {
      return { record: duplicate, duplicate: true };
    }

    records.unshift(record);
    this.writeCollection(this.contactKey, records);
    return { record, duplicate: false };
  }
}

let repositoryInstance;

export function getPublicInquiryRepository(options) {
  if (options) {
    return new LocalPublicInquiryRepository(options);
  }

  repositoryInstance ||= new LocalPublicInquiryRepository();
  return repositoryInstance;
}
