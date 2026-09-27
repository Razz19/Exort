#!/usr/bin/env bash
set -euo pipefail
set +x

: "${RUNNER_TEMP:?RUNNER_TEMP must point to the disposable CI directory}"
keychain_path="$RUNNER_TEMP/exort-signing.keychain-db"
certificate_path="$RUNNER_TEMP/exort-signing.p12"

case "${1:-}" in
  setup)
    : "${MAC_CSC_LINK:?Missing signing certificate}"
    : "${MAC_CSC_KEY_PASSWORD:?Missing certificate export password}"
    : "${GITHUB_ENV:?Missing GitHub Actions environment file}"
    umask 077
    trap 'rm -f "$certificate_path"' EXIT
    keychain_password="$(openssl rand -hex 32)"
    printf '::add-mask::%s\n' "$keychain_password"
    printf '%s' "$MAC_CSC_LINK" | base64 --decode > "$certificate_path"
    security create-keychain -p "$keychain_password" "$keychain_path"
    security set-keychain-settings -lut 21600 "$keychain_path"
    security unlock-keychain -p "$keychain_password" "$keychain_path"
    security import "$certificate_path" -k "$keychain_path" \
      -P "$MAC_CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productbuild
    # -P above decrypts the certificate; -k below unlocks the keychain.
    security set-key-partition-list -S apple-tool:,apple: -s \
      -k "$keychain_password" "$keychain_path" > /dev/null
    printf 'CSC_KEYCHAIN=%s\n' "$keychain_path" >> "$GITHUB_ENV"
    ;;
  cleanup)
    if [[ -e "$keychain_path" ]]; then
      security delete-keychain "$keychain_path"
    fi
    rm -f "$certificate_path"
    ;;
  *)
    echo 'Usage: macos-signing-keychain.sh setup|cleanup' >&2
    exit 2
    ;;
esac
