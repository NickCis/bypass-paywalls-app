# Bypass Paywalls for Expo

[![runs with expo](https://img.shields.io/badge/Runs%20with%20Expo-000.svg?style=flat&logo=EXPO&labelColor=ffffff&logoColor=000)](https://expo.io/@nickcis/bypass-paywalls-app)

The logic behind the bypasing algorithm was taken from [_Bypass Paywalls for Firefox_](https://github.com/iamadamdev/bypass-paywalls-firefox) (particularly `3fdcea389326b1f0b082beef34a0edf529043bca` commit).

## How does this work

Well, as Expo doesn't allow to monitoring request in the webview, requests are done in the react native land.
When the html is download an script is inyected in order to monkey patch all ajax requests. So, expect bugs, please report them :).

## Pull Requests

PRs are welcome.

## License

Bypass Paywalls is [MIT-licensed](./LICENSE).
