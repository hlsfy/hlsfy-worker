import { AzureBlobStorageClient } from "./azure";
import { GcsStorageClient } from "./gcs";
import { S3StorageClient } from "./s3";
import { AwsS3Config, AzureBlobConfig, GcsConfig, StorageClient } from "./type";

export const getStorageClient = (inputStorage: string) => {
  const storage = JSON.parse(inputStorage);
  const provider = storage.provider;

  let storageClient: StorageClient | null = null;

  switch (provider) {
    case "AWS_S3":
      storageClient = new S3StorageClient(storage.config as AwsS3Config);
      break;
    case "GCS":
      storageClient = new GcsStorageClient(storage.config as GcsConfig);
      break;
    case "AZURE_BLOB":
      storageClient = new AzureBlobStorageClient(
        storage.config as AzureBlobConfig
      );
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!storageClient) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return storageClient;
};
