/* eslint-disable indent */
export {};
const TODAY = "2023-01-29";
const CHECK_TIME = true; // 時間をチェックするかどうか
const SLACK_API_TOKEN = PropertiesService.getScriptProperties().getProperty("slack_api_token");
const STATUS_EXPIRE_SEC = 60 * 5; // 5分がexpire
const SPOTIFY_CLIENT_ID = PropertiesService.getScriptProperties().getProperty("spotify_client_id");
const SPOTIFY_CLIENT_SECRET = PropertiesService.getScriptProperties().getProperty("spotify_client_secret");
const SPOTIFY_AUTH_CODE = PropertiesService.getScriptProperties().getProperty("spotify_auth_code");
const SPOTIFY_BASIC_AUTH = Utilities.base64Encode(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET);
const SPOTIFY_ACCESS_TOKEN_KEY = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_KEY = "spotify_refresh_token";

// eslint-disable-next-line no-unused-vars
function main() {
  if (CHECK_TIME) {
    const now = new Date();
    const today = new Date(Date.parse(TODAY));
    console.log(`now: ${now}, today: ${today}`);
    if (now.getFullYear() !== today.getFullYear() || now.getMonth() !== today.getMonth() || now.getDay() !== today.getDay()) {
      console.log("SKIP BECAUSE IS NOT TODAY");
      return;
    }
    if (now.getHours() < 10 || now.getHours() > 19) {
      console.log("SKIP BECAUSE OF HOUR");
      return;
    }
    if (now.getUTCDay() === 0 || now.getUTCDay() === 6) {
      // 日曜日と土曜日はスキップする
      console.log("SKIP BECAUSE OF DATE");
      return;
    }
  }
  let accessToken = PropertiesService.getScriptProperties().getProperty(SPOTIFY_ACCESS_TOKEN_KEY);
  if (accessToken === null) {
    accessToken = getFirstAccessTokenToSpotify(SPOTIFY_AUTH_CODE, SPOTIFY_BASIC_AUTH);
  }
  const songText = getNowPlaying(accessToken, SPOTIFY_BASIC_AUTH);
  if (songText !== null) {
    notifySlack(songText);
    console.log(songText);
  } else {
    console.log("NOT PLAYING");
  }
}

const notifySlack = (text: string) => {
    const now = Math.floor((new Date()).getTime() / 1000);
    const req = {
      "profile": {
        "status_text": text.slice(0, 100),
        "status_emoji": ":spotify:",
        "status_expiration": now + STATUS_EXPIRE_SEC,
      },
    };
    const headers = {
      "Authorization": "Bearer " + SLACK_API_TOKEN,
      "Content-Type": "application/json; charset=utf-8"
    };
    const options = {
      "method": "post",
      "headers": headers,
      "payload": JSON.stringify(req)
    };
    // @ts-ignore
    const res = UrlFetchApp.fetch("https://slack.com/api/users.profile.set", options);
    console.log(JSON.parse(res.getContentText()));
  }
;

// https://qiita.com/nozomit/items/0bec86a08f967aaa0762
const getFirstAccessTokenToSpotify = (authCode: string | null, basicAuth: string): string => {
  const headers = {"Authorization": "Basic " + basicAuth};
  const payload = {
    "grant_type": "authorization_code",
    "code": authCode,
    "redirect_uri": "https://example.com/callback"
  };
  const options = {
    "payload": payload,
    "headers": headers,
  };
  const response = UrlFetchApp.fetch("https://accounts.spotify.com/api/token", options);

  const parsedResponse = JSON.parse(response.getContentText());
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperties({
    [SPOTIFY_ACCESS_TOKEN_KEY]: parsedResponse.access_token,
    [SPOTIFY_REFRESH_TOKEN_KEY]: parsedResponse.refresh_token
  });
  return parsedResponse.access_token;
};

const refreshAccessTokenToSpotify = (basicAuth: string) => {
  const scriptProperties = PropertiesService.getScriptProperties();
  const refreshToken = scriptProperties.getProperty(SPOTIFY_REFRESH_TOKEN_KEY);

  const headers = {
    "Authorization": "Basic " + basicAuth,
    "Content-Type": "application/x-www-form-urlencoded"
  };
  const payload = {
    "grant_type": "refresh_token",
    "refresh_token": refreshToken
  };
  const options = {
    "payload": payload,
    "headers": headers,
  };
  const response = UrlFetchApp.fetch("https://accounts.spotify.com/api/token", options);

  const parsedResponse = JSON.parse(response.getContentText());
  scriptProperties.setProperty(SPOTIFY_ACCESS_TOKEN_KEY, parsedResponse.access_token);
  // refresh_token は毎回発行されるとは限らない
  if (parsedResponse.refresh_token) {
    scriptProperties.setProperty(SPOTIFY_REFRESH_TOKEN_KEY, parsedResponse.refresh_token);
  }
  return parsedResponse.access_token;
};

const getNowPlaying = (accessToken: string, basicAuth: string, retry = 0): string | null => {
  if (retry >= 3) {
    console.log(`RETRY ${retry}`);
    return null;
  }
  const options = {
    "headers": {"Authorization": "Bearer " + accessToken},
    "muteHttpExceptions": true, // 401エラーへの対応のため,
    "Accept-Language": "ja"
  };
  const response = UrlFetchApp.fetch("https://api.spotify.com/v1/me/player/currently-playing", options);

  switch (response.getResponseCode()) {
    case 200: // Spotify の曲をセット
      return getArtistAndSongString(JSON.parse(response.getContentText()));
    case 204: // 何も聞いていない
      return null;
    case 401: // access_token が切れた
      // eslint-disable-next-line no-case-declarations
      const refreshToken = refreshAccessTokenToSpotify(basicAuth);
      console.log(`ACCESS TOKEN IS INVALID: retry: ${retry}`);
      return getNowPlaying(refreshToken, basicAuth, retry + 1);
    default:
      // 実行されない想定
      console.log(`INVALID RESPONSE ${response.getResponseCode()}`);
      return null;
  }
};

const getArtistAndSongString = (response: any): string => {
  const artists = response.item.artists.map((artist: any) => artist.name);
  const song = response.item.name;
  let url: string | undefined = response.item.external_urls?.spotify;
  if (url === undefined) {
    url = "";
  }
  return `${song} - ${artists.join(", ")}\n${url}`;
};
