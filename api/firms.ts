import { handleFirms, toResponse } from '../server/handlers';

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  return toResponse(await handleFirms(params, process.env));
}
