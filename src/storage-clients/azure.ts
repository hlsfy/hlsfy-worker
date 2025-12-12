import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { AzureBlobConfig, StorageClient } from "./type";

const streamPipeline = promisify(pipeline);

export class AzureBlobStorageClient implements StorageClient {
  private config: AzureBlobConfig;
  private blobServiceClient: BlobServiceClient;

  constructor(config: AzureBlobConfig) {
    this.config = this.validateConfig(config);

    if (this.config.connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        this.config.connectionString
      );
    } else {
      const accountName = this.config.accountName as string;
      const accountKey = this.config.accountKey as string;
      const credential = new StorageSharedKeyCredential(
        accountName,
        accountKey
      );
      const endpoint =
        this.config.blobEndpoint ??
        `https://${accountName}.blob.core.windows.net`;

      this.blobServiceClient = new BlobServiceClient(endpoint, credential);
    }
  }

  private validateConfig(config: AzureBlobConfig): AzureBlobConfig {
    const hasConnectionString = Boolean(config.connectionString);
    const hasAccountCreds = Boolean(config.accountName && config.accountKey);

    if (!config.container) {
      throw new Error("Azure Blob container is required");
    }

    if (!hasConnectionString && !hasAccountCreds) {
      throw new Error(
        "Provide either connectionString or accountName/accountKey for Azure Blob"
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
      throw new Error("Azure Blob key is required");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const containerClient = this.blobServiceClient.getContainerClient(
      this.config.container
    );
    const blobClient = containerClient.getBlobClient(key);
    const response = await blobClient.download();

    if (!response.readableStreamBody) {
      throw new Error("No body returned from Azure Blob download");
    }

    const fileStream = fs.createWriteStream(outputPath);
    await streamPipeline(
      response.readableStreamBody as NodeJS.ReadableStream,
      fileStream
    );
  }
}
