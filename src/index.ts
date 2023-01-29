/* eslint-disable indent */
export {};
const SLACK_API_TOKEN = PropertiesService.getScriptProperties().getProperty("slack_api_token");
const STATUS_EXPIRE_SEC = 60 * 60 * 5 // 5分がexpire

// eslint-disable-next-line no-unused-vars
function main() {
  notifySlack();
}

const notifySlack = () => {
    const now = Math.floor((new Date()).getTime() / 1000);
    const req = {
      "profile": {
        "status_text": "fugauga",
        "status_emoji": ":smile:",
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
