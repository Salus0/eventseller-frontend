const backend = import.meta.env.PUBLIC_BACKEND_URL;

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${backend}${path}`, options);
  return res.json();
}
