
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  console.log(
    'NATIVE INTENT PATH:',
    path
  );

  /*
   * EMAIL CONFIRMATION
   *
   * omnibin://auth/callback
   */

  if (
    path.startsWith(
      '/auth/callback'
    )
  ) {
    return '/';
  }

  /*
   * PASSWORD RESET
   *
   * Keep password recovery working.
   */

  if (
    path.startsWith(
      '/reset-password'
    )
  ) {
    return '/reset-password';
  }

  /*
   * Return the original path
   * for everything else.
   */

  return path;
}