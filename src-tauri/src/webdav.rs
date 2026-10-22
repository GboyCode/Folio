use reqwest::{redirect::Policy, Client, Method, Url};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};

const MAX_BYTES: usize = 12 * 1024 * 1024;
const MAX_METADATA_BYTES: usize = 64 * 1024;

#[derive(Deserialize)]
pub struct DavRequest {
    url: String,
    method: String,
    username: String,
    password: String,
    body: String,
    etag: Option<String>,
}

#[derive(Serialize)]
pub struct DavResponse {
    status: u16,
    etag: Option<String>,
    body: String,
    redirected: bool,
}

fn validate(request: &DavRequest) -> Result<(Url, Method), String> {
    let url = Url::parse(&request.url).map_err(|_| "WebDAV 地址无效。")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || request.url.len() > 4096
    {
        return Err("WebDAV 需要不含账号和查询参数的 HTTPS 地址。".into());
    }
    if !matches!(
        request.method.as_str(),
        "GET" | "PUT" | "PROPFIND" | "MKCOL"
    ) || request.username.is_empty()
        || request.username.len() > 1200
        || request.password.is_empty()
        || request.password.len() > 4000
        || request.username.contains([':', '\r', '\n'])
        || request.password.contains(['\r', '\n'])
        || request.body.len() > MAX_BYTES
    {
        return Err("WebDAV 请求内容无效。".into());
    }
    if let Some(etag) = &request.etag {
        if etag.len() < 2
            || etag.len() > 512
            || !etag.starts_with('"')
            || !etag.ends_with('"')
            || etag[1..etag.len() - 1]
                .bytes()
                .any(|b| b <= 32 || b == 127 || b == b'"')
        {
            return Err("远程文件版本无效，请重新检查后上传。".into());
        }
    }
    if request.method == "PUT" {
        // The frontend performs schema validation; reject non-JSON IPC payloads too.
        let value: serde_json::Value =
            serde_json::from_str(&request.body).map_err(|_| "备份格式不正确。")?;
        if value.get("version").and_then(|v| v.as_u64()) != Some(1)
            || !(value.get("entries").is_some_and(|v| v.is_array())
                || value.get("format").and_then(|v| v.as_str()) == Some("mrgcard-encrypted"))
        {
            return Err("备份格式不正确。".into());
        }
    }
    let method = Method::from_bytes(request.method.as_bytes()).map_err(|_| "WebDAV 操作无效。")?;
    Ok((url, method))
}

fn redirect_target(
    current: &Url,
    location: &str,
    method: &str,
    status: u16,
) -> Result<Url, String> {
    let next = current
        .join(location)
        .map_err(|_| "WebDAV 返回了无效的重定向地址。")?;
    if location.is_empty()
        || next.as_str().len() > 8192
        || next.scheme() != "https"
        || !next.username().is_empty()
        || next.password().is_some()
        || next.fragment().is_some()
    {
        return Err("WebDAV 重定向必须使用不含账号信息的 HTTPS 地址。".into());
    }
    if method != "GET" && (next.origin() != current.origin() || status == 303) {
        return Err("WebDAV 写入或目录请求发生跨站重定向，请使用最终 WebDAV 服务地址。".into());
    }
    if next.origin() != current.origin() {
        let host = next.host_str().unwrap_or("").trim_end_matches('.');
        if !host.contains('.')
            || host.parse::<std::net::IpAddr>().is_ok()
            || [
                "localhost",
                "local",
                "internal",
                "lan",
                "home",
                "test",
                "invalid",
            ]
            .iter()
            .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
        {
            return Err("WebDAV 下载重定向不能指向本机或内网地址。".into());
        }
    }
    Ok(next)
}

#[tauri::command]
pub async fn webdav_request(request: DavRequest) -> Result<DavResponse, String> {
    let (mut url, method) = validate(&request)?;
    let client = Client::builder()
        .redirect(Policy::none())
        .https_only(true)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| "无法初始化 WebDAV 连接。")?;
    let started = Instant::now();
    let mut authenticated = true;
    let mut redirects = 0;
    let mut visited = HashSet::from([url.to_string()]);
    let mut response = loop {
        let remaining = Duration::from_secs(30)
            .checked_sub(started.elapsed())
            .ok_or("WebDAV 请求超时，请重试。")?;
        let mut pending = client
            .request(method.clone(), url.clone())
            .timeout(remaining)
            .header("Cache-Control", "no-cache");
        if authenticated {
            pending = pending.basic_auth(&request.username, Some(&request.password));
        }
        if request.method == "PROPFIND" {
            pending = pending.header("Depth", "0");
        }
        if request.method == "PUT" {
            pending = pending.header("Content-Type", "application/json; charset=utf-8");
            pending = match &request.etag {
                Some(etag) => pending.header("If-Match", etag),
                None => pending.header("If-None-Match", "*"),
            };
            pending = pending.body(request.body.clone());
        }
        let response = pending.send().await.map_err(|_| {
            if request.method == "PUT" {
                "上传连接中断或超时，远程文件可能已写入。请先拉取检查，再重试。"
            } else {
                "无法连接 WebDAV 或请求超时，请检查地址、网络和证书。"
            }
        })?;
        let status = response.status().as_u16();
        if !matches!(status, 301 | 302 | 303 | 307 | 308) {
            break response;
        }
        let location = response
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let next = redirect_target(&url, location, &request.method, status)?;
        if redirects >= 5 || !visited.insert(next.to_string()) {
            return Err("WebDAV 重定向次数过多或发生循环。".into());
        }
        if next.origin() != url.origin() {
            authenticated = false;
        }
        redirects += 1;
        url = next;
    };
    let status = response.status().as_u16();
    let etag = response
        .headers()
        .get("ETag")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let mut bytes = Vec::new();
    let limit = if request.method == "GET" && status == 200 {
        MAX_BYTES
    } else if request.method == "PROPFIND" && status == 207 {
        MAX_METADATA_BYTES
    } else {
        0
    };
    if limit > 0 {
        if response.content_length().is_some_and(|n| n > limit as u64) {
            return Err("WebDAV 响应超过大小限制。".into());
        }
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "读取远程备份中断，请重试。")?
        {
            if bytes.len() + chunk.len() > limit {
                return Err("WebDAV 响应超过大小限制。".into());
            }
            bytes.extend_from_slice(&chunk);
        }
    }
    let body = String::from_utf8(bytes).map_err(|_| "远程备份不是 UTF-8 JSON 文件。")?;
    Ok(DavResponse {
        status,
        etag,
        body,
        redirected: redirects > 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redirect_rules_allow_signed_downloads_but_not_cross_origin_writes() {
        let current = Url::parse("https://dav.example.com/dav/folio.json").unwrap();
        assert!(redirect_target(
            &current,
            "https://cdn.example.com/file?signature=test",
            "GET",
            302
        )
        .is_ok());
        assert!(redirect_target(&current, "../canonical/", "PROPFIND", 301).is_ok());
        for target in [
            "http://cdn.example.com/file",
            "https://u:p@cdn.example.com/file",
            "https://127.0.0.1/file",
            "https://server.local/file",
            "",
        ] {
            assert!(redirect_target(&current, target, "GET", 302).is_err());
        }
        for method in ["PUT", "MKCOL", "PROPFIND"] {
            assert!(
                redirect_target(&current, "https://cdn.example.com/file", method, 307).is_err()
            );
            assert!(redirect_target(&current, "/other", method, 303).is_err());
        }
    }

    fn request() -> DavRequest {
        DavRequest {
            url: "https://dav.example.com/folio.json".into(),
            method: "PUT".into(),
            username: "user".into(),
            password: "app-password".into(),
            body: r#"{"version":1,"entries":[]}"#.into(),
            etag: Some("\"version-1\"".into()),
        }
    }

    #[test]
    fn allows_https_backup_requests_and_rejects_unsafe_ipc() {
        assert!(validate(&request()).is_ok());
        let mut mkdir = request();
        mkdir.method = "MKCOL".into();
        mkdir.body.clear();
        assert!(validate(&mkdir).is_ok());
        for url in [
            "http://dav.example.com/folio.json",
            "https://user:secret@dav.example.com/",
            "file:///tmp/wallet.json",
            "https://dav.example.com/?password=x",
        ] {
            let mut r = request();
            r.url = url.into();
            assert!(validate(&r).is_err());
        }
        for method in ["DELETE", "MOVE", "POST"] {
            let mut r = request();
            r.method = method.into();
            assert!(validate(&r).is_err());
        }
        for etag in ["*", "W/\"weak\"", "\"x\"\r\nInjected: value"] {
            let mut r = request();
            r.etag = Some(etag.into());
            assert!(validate(&r).is_err());
        }
        let mut r = request();
        r.body = "not a backup".into();
        assert!(validate(&r).is_err());
    }
}
