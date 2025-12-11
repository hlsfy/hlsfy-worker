import axios from "axios";

export function getApiClient(apiKey?: string) {
  const hlsfyApiKey = apiKey || process.env.HLSFY_API_KEY;
  const hlsfyApiBaseUrl =
    process.env.HLSFY_API_BASE_URL || "https://api.hlsfy.org";

  if (!hlsfyApiKey) {
    throw new Error("HLSFY_API_KEY environment variable is not set");
  }

  const axiosInstance = axios.create({
    baseURL: hlsfyApiBaseUrl,
    headers: {
      Authorization: `Bearer ${hlsfyApiKey}`,
    },
  });

  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      const errorObject = error?.response?.data || error;
      throw errorObject;
    },
  );

  return axiosInstance;
}

export async function createAction({
  externalTranscodeId,
  action,
  payload,
  payloadFromActionId,
}: {
  externalTranscodeId: string | null;
  action: string;
  payload: any;
  payloadFromActionId: string | null;
}): Promise<string | null> {
  if (!process.env.HLSFY_API_KEY || !externalTranscodeId) return null;

  const apiClient = getApiClient(process.env.HLSFY_API_KEY);

  const response = await apiClient.post(
    `/v1/transcodes/${externalTranscodeId}/actions`,
    {
      action,
      payload,
      payloadFromActionId,
    },
  );

  return response.data.id;
}

export async function updateActionStatus({
  externalTranscodeId,
  externalActionId,
  status,
}: {
  externalTranscodeId: string | null;
  externalActionId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
}): Promise<string | null> {
  if (!externalTranscodeId || !externalActionId || !process.env.HLSFY_API_KEY)
    return null;

  const apiClient = getApiClient(process.env.HLSFY_API_KEY);

  const response = await apiClient.put(
    `/v1/transcodes/${externalTranscodeId}/actions`,
    {
      id: externalActionId,
      status,
    },
  );

  return response.data.id;
}

export async function createActionOutput({
  externalTranscodeId,
  externalActionId,
  output,
}: {
  externalTranscodeId: string | null;
  externalActionId: string | null;
  output: any;
}): Promise<string | null> {
  if (!externalTranscodeId || !externalActionId || !process.env.HLSFY_API_KEY)
    return null;

  const apiClient = getApiClient(process.env.HLSFY_API_KEY);

  const response = await apiClient.post(
    `/v1/transcodes/${externalTranscodeId}/actions/outputs`,
    {
      actionId: externalActionId,
      output,
    },
  );

  return response.data.id;
}
