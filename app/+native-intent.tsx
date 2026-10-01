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

  try {
    /*
     * =====================================================
     * EMAIL CONFIRMATION
     * =====================================================
     *
     * Supabase may send:
     *
     * omnibin://auth/callback
     *
     * or:
     *
     * omnibin://auth/callback?code=...
     *
     * Keep the callback path and its parameters.
     */

    if (
      path.includes(
        '/auth/callback'
      )
    ) {
      return path;
    }


    /*
     * =====================================================
     * PASSWORD RESET
     * =====================================================
     *
     * Keep the password reset route
     * and its parameters.
     */

    if (
      path.includes(
        '/reset-password'
      )
    ) {
      return path;
    }


    /*
     * =====================================================
     * EVERYTHING ELSE
     * =====================================================
     */

    return path;

  } catch (error) {

    console.error(
      'NATIVE INTENT ERROR:',
      error
    );

    /*
     * If something unexpected happens,
     * safely return to the login page.
     */

    return '/';
  }
}