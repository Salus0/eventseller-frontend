import { redirect } from "@sveltejs/kit";

export const load = async ({ url, cookies, fetch }) => {
  const code = url.searchParams.get("code");
  const backend = process.env.PUBLIC_BACKEND_URL;

  const res = await fetch(`${backend}/auth/discord/callback?code=${code}`);
  const user = await res.json();

  cookies.set("user", JSON.stringify(user), {
    path: "/",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7
  });

  throw redirect(302, "/profile");
};
