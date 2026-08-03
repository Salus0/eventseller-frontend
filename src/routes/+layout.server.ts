export const load = async ({ cookies }) => {
  const user = cookies.get("user");
  return { user: user ? JSON.parse(user) : null };
};
