export type AwsS3Config = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

export type GcsConfig = {
  projectId: string;
  bucket: string;
  clientEmail: string;
  privateKey: string;
};

export type AzureBlobConfig = {
  connectionString?: string;
  accountName?: string;
  accountKey?: string;
  blobEndpoint?: string;
  container: string;
};

export interface StorageClient {
  downloadFile({
    key,
    outputPath,
  }: {
    key: string;
    outputPath: string;
  }): Promise<void>;
}
