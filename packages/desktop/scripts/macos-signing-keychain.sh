#!/usr/bin/env bash
set -euo pipefail
set +x

: "${RUNNER_TEMP:?RUNNER_TEMP must point to the disposable CI directory}"
keychain_path="$RUNNER_TEMP/exort-signing.keychain-db"
certificate_path="$RUNNER_TEMP/exort-signing.p12"
search_list_path="$RUNNER_TEMP/exort-keychain-search-list.txt"

read_saved_keychains() {
  saved_keychains=()
  while IFS= read -r line; do
    # security prints one quoted absolute path per line.
    line="${line#*\"}"
    line="${line%\"*}"
    if [[ -n "$line" ]]; then saved_keychains+=("$line"); fi
  done < "$search_list_path"
}

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
    security list-keychains -d user > "$search_list_path"
    read_saved_keychains
    security create-keychain -p "$keychain_password" "$keychain_path"
    # codesign still needs the keychain in the user's search list, even when
    # electron-builder passes an explicit --keychain path.
    security list-keychains -d user -s "$keychain_path" "${saved_keychains[@]}"
    security set-keychain-settings -lut 21600 "$keychain_path"
    security unlock-keychain -p "$keychain_password" "$keychain_path"
    security import "$certificate_path" -k "$keychain_path" \
      -P "$MAC_CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productbuild
    # -P above decrypts the certificate; -k below unlocks the keychain.
    security set-key-partition-list -S apple-tool:,apple: -s \
      -k "$keychain_password" "$keychain_path" > /dev/null
    printf 'CSC_KEYCHAIN=%s\n' "$keychain_path" >> "$GITHUB_ENV"
    ;;
  verify)
    identity="$(security find-identity -v -p codesigning "$keychain_path" | awk '/"Developer ID Application:/ { print $2; exit }')"
    if [[ -z "$identity" ]]; then
      echo 'No valid Developer ID Application identity found. MAC_CSC_LINK must include the unexpired certificate and its private key, exported together as .p12.' >&2
      exit 1
    fi
    probe_path="$RUNNER_TEMP/exort-codesign-probe"
    trap 'rm -f "$probe_path"' EXIT
    cp /usr/bin/true "$probe_path"
    chmod u+w "$probe_path"
    codesign --force --sign "$identity" --keychain "$keychain_path" \
      --timestamp --options runtime "$probe_path"
    codesign --verify --strict "$probe_path"
    echo 'Developer ID Application signing preflight passed.'
    ;;
  cleanup)
    if [[ -f "$search_list_path" ]]; then
      read_saved_keychains
      security list-keychains -d user -s "${saved_keychains[@]}"
      rm -f "$search_list_path"
    fi
    if [[ -e "$keychain_path" ]]; then
      security delete-keychain "$keychain_path"
    fi
    rm -f "$certificate_path"
    ;;
  *)
    echo 'Usage: macos-signing-keychain.sh setup|verify|cleanup' >&2
    exit 2
    ;;
esac
