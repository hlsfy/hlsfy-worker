import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";
import { GcsConfig, StorageClient } from "./type";

export class GcsStorageClient implements StorageClient {
  private config: GcsConfig;
  private storage: Storage;

  constructor(config: GcsConfig) {
    this.config = this.validateConfig(config);
    this.storage = new Storage({
      projectId: this.config.projectId,
      credentials: {
        client_email: this.config.clientEmail,
        private_key: this.config.privateKey.replace(/\\n/g, "\n"),
      },
    });
  }

  private validateConfig(config: GcsConfig): GcsConfig {
    const { projectId, bucket, clientEmail, privateKey } = config;

    if (!projectId || !bucket || !clientEmail || !privateKey) {
      throw new Error(
        "Missing required GCS config (projectId/bucket/clientEmail/privateKey)"
      );
    }

    return config;
  }

  async downloadFile({
    key,
    outputPath,
  }: {
    key: string;
    outputPath: string;
  }): Promise<void> {
    if (!key) {
      throw new Error("GCS object key is required");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const bucket = this.storage.bucket(this.config.bucket);
    const file = bucket.file(key);

    await file.download({ destination: outputPath });
  }
}
