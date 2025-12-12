import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { AwsS3Config, StorageClient } from "./type";

const streamPipeline = promisify(pipeline);

export class S3StorageClient implements StorageClient {
  private config: AwsS3Config;
  private client: S3Client;

  constructor(config: AwsS3Config) {
    this.config = this.validateConfig(config);
    this.client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
    });
  }

  private validateConfig(config: AwsS3Config): AwsS3Config {
    const { accessKeyId, secretAccessKey, region, bucket } = config;

    if (!accessKeyId || !secretAccessKey || !region || !bucket) {
      throw new Error(
        "Missing required S3 config (access/secret/region/bucket)"
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
      throw new Error("S3 key is required");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error("No body returned from S3 download");
    }

    const fileStream = fs.createWriteStream(outputPath);
    await streamPipeline(response.Body as NodeJS.ReadableStream, fileStream);
  }
}
