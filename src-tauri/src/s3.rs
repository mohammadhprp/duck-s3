use aws_credential_types::Credentials;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::{
    config::{BehaviorVersion, Region},
    primitives::ByteStream,
    types::{CompletedMultipartUpload, CompletedPart},
    Client as S3Client,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::Emitter;

#[derive(Debug, Deserialize)]
pub struct S3Profile {
    pub endpoint: Option<String>,
    pub region: String,
    pub use_ssl: bool,
    pub force_path_style: bool,
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Debug, Serialize)]
pub struct S3Bucket {
    pub name: String,
    pub creation_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct S3ObjectFolder {
    pub name: String,
    pub prefix: String,
}

#[derive(Debug, Serialize)]
pub struct S3ObjectFile {
    pub key: String,
    pub name: String,
    pub size: i64,
    pub last_modified: Option<String>,
    pub storage_class: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct S3ObjectExplorerPage {
    pub bucket_name: String,
    pub prefix: String,
    pub folders: Vec<S3ObjectFolder>,
    pub files: Vec<S3ObjectFile>,
    pub object_count: usize,
    pub folder_count: usize,
    pub page_count: usize,
    pub continuation_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MultipartUploadPart {
    pub part_number: i32,
    pub e_tag: String,
}

#[derive(Debug, Serialize)]
pub struct MultipartUploadPartResult {
    pub part_number: i32,
    pub e_tag: String,
}

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub message: String,
    pub bucket_count: Option<usize>,
}

fn build_s3_client(profile: &S3Profile) -> S3Client {
    let credentials = Credentials::new(
        &profile.access_key_id,
        &profile.secret_access_key,
        None,
        None,
        "frontend",
    );

    let endpoint_url = if let Some(ref ep) = profile.endpoint {
        if ep.starts_with("http://") || ep.starts_with("https://") {
            ep.clone()
        } else {
            let scheme = if profile.use_ssl { "https" } else { "http" };
            format!("{scheme}://{ep}")
        }
    } else {
        format!(
            "{}://s3.{}.amazonaws.com",
            if profile.use_ssl { "https" } else { "http" },
            profile.region
        )
    };

    let config = S3ConfigBuilder::new()
        .credentials_provider(credentials)
        .region(Region::new(profile.region.clone()))
        .endpoint_url(&endpoint_url)
        .force_path_style(profile.force_path_style)
        .behavior_version(BehaviorVersion::latest())
        .build();

    S3Client::from_conf(config)
}

#[tauri::command]
pub async fn s3_list_buckets(profile: S3Profile) -> Result<Vec<S3Bucket>, String> {
    let client = build_s3_client(&profile);

    match client.list_buckets().send().await {
        Ok(output) => {
            let mut buckets: Vec<S3Bucket> = output
                .buckets()
                .iter()
                .filter_map(|b| {
                    b.name().map(|name| S3Bucket {
                        name: name.to_string(),
                        creation_date: b.creation_date().map(|d| d.to_string()),
                    })
                })
                .collect();
            buckets.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(buckets)
        }
        Err(e) => {
            eprintln!("S3 list buckets error: {:?}", e);
            Err(format!("S3 error: {e:?}"))
        }
    }
}

#[tauri::command]
pub async fn s3_create_bucket(profile: S3Profile, bucket_name: String) -> Result<(), String> {
    let client = build_s3_client(&profile);

    let mut req = client.create_bucket().bucket(&bucket_name);

    if profile.region != "us-east-1" {
        req = req.create_bucket_configuration(
            aws_sdk_s3::types::CreateBucketConfiguration::builder()
                .location_constraint(aws_sdk_s3::types::BucketLocationConstraint::from(
                    profile.region.as_str(),
                ))
                .build(),
        );
    }

    req.send().await.map_err(|e| format!("S3 error: {e:?}"))?;
    Ok(())
}

#[tauri::command]
pub async fn s3_delete_bucket(profile: S3Profile, bucket_name: String) -> Result<(), String> {
    let client = build_s3_client(&profile);

    client
        .delete_bucket()
        .bucket(&bucket_name)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;
    Ok(())
}

#[tauri::command]
pub async fn s3_list_objects(
    profile: S3Profile,
    bucket_name: String,
    prefix: String,
    continuation_token: Option<String>,
) -> Result<S3ObjectExplorerPage, String> {
    let client = build_s3_client(&profile);
    let normalized_prefix = normalize_prefix(&prefix);
    let mut folders_by_prefix: BTreeMap<String, S3ObjectFolder> = BTreeMap::new();
    let mut files: Vec<S3ObjectFile> = Vec::new();

    let mut request = client
        .list_objects_v2()
        .bucket(&bucket_name)
        .delimiter("/")
        .prefix(&normalized_prefix)
        .max_keys(1000);

    if let Some(token) = continuation_token.as_deref() {
        request = request.continuation_token(token);
    }

    let output = request
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    for common_prefix in output.common_prefixes() {
        if let Some(folder_prefix) = common_prefix.prefix() {
            if folder_prefix == normalized_prefix {
                continue;
            }

            let folder_name = folder_name_from_prefix(folder_prefix, &normalized_prefix);

            if !folder_name.is_empty() {
                folders_by_prefix.insert(
                    folder_prefix.to_string(),
                    S3ObjectFolder {
                        name: folder_name,
                        prefix: folder_prefix.to_string(),
                    },
                );
            }
        }
    }

    for object in output.contents() {
        let Some(key) = object.key() else {
            continue;
        };

        if key == normalized_prefix || key.ends_with('/') {
            continue;
        }

        let file_name = object_name_from_key(key, &normalized_prefix);

        if file_name.is_empty() || file_name.contains('/') {
            continue;
        }

        files.push(S3ObjectFile {
            key: key.to_string(),
            name: file_name,
            size: object.size().unwrap_or_default(),
            last_modified: object.last_modified().map(|d| d.to_string()),
            storage_class: object
                .storage_class()
                .map(|storage_class| storage_class.as_str().to_string()),
        });
    }

    let continuation_token = output.next_continuation_token().map(ToString::to_string);

    let mut folders: Vec<S3ObjectFolder> = folders_by_prefix.into_values().collect();
    folders.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(S3ObjectExplorerPage {
        bucket_name,
        prefix: normalized_prefix,
        object_count: files.len(),
        folder_count: folders.len(),
        page_count: 1,
        continuation_token,
        folders,
        files,
    })
}

fn normalize_prefix(prefix: &str) -> String {
    let trimmed_prefix = prefix.trim().trim_start_matches('/');

    if trimmed_prefix.is_empty() {
        return String::new();
    }

    if trimmed_prefix.ends_with('/') {
        trimmed_prefix.to_string()
    } else {
        format!("{trimmed_prefix}/")
    }
}

fn folder_name_from_prefix(folder_prefix: &str, current_prefix: &str) -> String {
    folder_prefix
        .strip_prefix(current_prefix)
        .unwrap_or(folder_prefix)
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string()
}

fn object_name_from_key(key: &str, current_prefix: &str) -> String {
    key.strip_prefix(current_prefix)
        .unwrap_or(key)
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
pub async fn s3_create_multipart_upload(
    profile: S3Profile,
    bucket_name: String,
    key: String,
    content_type: Option<String>,
) -> Result<String, String> {
    let client = build_s3_client(&profile);
    let mut request = client
        .create_multipart_upload()
        .bucket(&bucket_name)
        .key(&key);

    if let Some(content_type) = content_type.filter(|value| !value.trim().is_empty()) {
        request = request.content_type(content_type);
    }

    let output = request
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    output
        .upload_id()
        .map(ToString::to_string)
        .ok_or_else(|| "S3 did not return a multipart upload id.".to_string())
}

#[tauri::command]
pub async fn s3_upload_part(
    profile: S3Profile,
    bucket_name: String,
    key: String,
    upload_id: String,
    part_number: i32,
    body: Vec<u8>,
) -> Result<MultipartUploadPartResult, String> {
    let client = build_s3_client(&profile);
    let output = client
        .upload_part()
        .bucket(&bucket_name)
        .key(&key)
        .upload_id(upload_id)
        .part_number(part_number)
        .body(ByteStream::from(body))
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    output
        .e_tag()
        .map(|e_tag| MultipartUploadPartResult {
            part_number,
            e_tag: e_tag.to_string(),
        })
        .ok_or_else(|| "S3 did not return an ETag for the uploaded part.".to_string())
}

#[tauri::command]
pub async fn s3_complete_multipart_upload(
    profile: S3Profile,
    bucket_name: String,
    key: String,
    upload_id: String,
    parts: Vec<MultipartUploadPart>,
) -> Result<(), String> {
    let client = build_s3_client(&profile);
    let mut completed_parts: Vec<CompletedPart> = parts
        .into_iter()
        .map(|part| {
            CompletedPart::builder()
                .part_number(part.part_number)
                .e_tag(part.e_tag)
                .build()
        })
        .collect();

    completed_parts.sort_by_key(|part| part.part_number().unwrap_or_default());

    let completed_upload = CompletedMultipartUpload::builder()
        .set_parts(Some(completed_parts))
        .build();

    client
        .complete_multipart_upload()
        .bucket(&bucket_name)
        .key(&key)
        .upload_id(upload_id)
        .multipart_upload(completed_upload)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    Ok(())
}

#[tauri::command]
pub async fn s3_abort_multipart_upload(
    profile: S3Profile,
    bucket_name: String,
    key: String,
    upload_id: String,
) -> Result<(), String> {
    let client = build_s3_client(&profile);

    client
        .abort_multipart_upload()
        .bucket(&bucket_name)
        .key(&key)
        .upload_id(upload_id)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    Ok(())
}

#[tauri::command]
pub async fn s3_test_connection(profile: S3Profile) -> Result<ConnectionTestResult, String> {
    let client = build_s3_client(&profile);

    match client.list_buckets().send().await {
        Ok(output) => Ok(ConnectionTestResult {
            ok: true,
            message: "Connection test succeeded.".to_string(),
            bucket_count: Some(output.buckets().len()),
        }),
        Err(e) => {
            eprintln!("S3 connection error: {:?}", e);
            Ok(ConnectionTestResult {
                ok: false,
                message: format!("S3 error: {e:?}"),
                bucket_count: None,
            })
        }
    }
}

#[derive(Debug, Serialize)]
pub struct S3ObjectInfo {
    pub key: String,
    pub size: i64,
    pub content_type: Option<String>,
    pub last_modified: Option<String>,
}

#[tauri::command]
pub async fn s3_get_object_info(
    profile: S3Profile,
    bucket_name: String,
    key: String,
) -> Result<S3ObjectInfo, String> {
    let client = build_s3_client(&profile);

    let output = client
        .head_object()
        .bucket(&bucket_name)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    Ok(S3ObjectInfo {
        key,
        size: output.content_length().unwrap_or(0),
        content_type: output.content_type().map(ToString::to_string),
        last_modified: output.last_modified().map(|d| d.to_string()),
    })
}

const DOWNLOAD_CHUNK_SIZE: usize = 8 * 1024 * 1024;

#[tauri::command]
pub async fn s3_download_object(
    app: tauri::AppHandle,
    profile: S3Profile,
    bucket_name: String,
    key: String,
    destination_path: String,
) -> Result<(), String> {
    let client = build_s3_client(&profile);

    let info = client
        .head_object()
        .bucket(&bucket_name)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    let total_size = info.content_length().unwrap_or(0) as usize;
    let download_id = format!("{}:{}", bucket_name, key);

    app.emit("download_progress", DownloadProgressEvent {
        id: download_id.clone(),
        status: "starting".to_string(),
        downloaded_bytes: 0,
        total_bytes: total_size,
        destination_path: destination_path.clone(),
        error: None,
    })
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    use std::fs;
    use std::path::Path;

    if let Some(parent) = Path::new(&destination_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let get_object_output = client
        .get_object()
        .bucket(&bucket_name)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    let mut file = fs::File::create(&destination_path)
        .map_err(|e| format!("Failed to create file: {e}"))?;

    use std::io::Write;
    let mut stream = get_object_output.body.into_async_read();
    let mut downloaded_bytes: usize = 0;
    let mut buffer = vec![0u8; DOWNLOAD_CHUNK_SIZE];

    loop {
        use tokio::io::AsyncReadExt;
        let bytes_read = stream
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read stream: {e}"))?;

        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Failed to write file: {e}"))?;

        downloaded_bytes += bytes_read;

        app.emit("download_progress", DownloadProgressEvent {
            id: download_id.clone(),
            status: "downloading".to_string(),
            downloaded_bytes,
            total_bytes: total_size,
            destination_path: destination_path.clone(),
            error: None,
        })
        .map_err(|e| format!("Failed to emit event: {e}"))?;
    }

    file.flush().map_err(|e| format!("Failed to flush file: {e}"))?;

    app.emit("download_progress", DownloadProgressEvent {
        id: download_id.clone(),
        status: "completed".to_string(),
        downloaded_bytes,
        total_bytes: total_size,
        destination_path: destination_path.clone(),
        error: None,
    })
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressEvent {
    pub id: String,
    pub status: String,
    pub downloaded_bytes: usize,
    pub total_bytes: usize,
    pub destination_path: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DownloadFolderResult {
    pub files_downloaded: usize,
    pub files_failed: usize,
    pub destination_path: String,
}

#[tauri::command]
pub async fn s3_download_folder(
    app: tauri::AppHandle,
    profile: S3Profile,
    bucket_name: String,
    prefix: String,
    destination_path: String,
) -> Result<DownloadFolderResult, String> {
    let client = build_s3_client(&profile);
    let mut files_downloaded = 0;
    let mut files_failed = 0;
    let folder_id = format!("folder:{}:{}", bucket_name, prefix);

    app.emit("download_progress", DownloadProgressEvent {
        id: folder_id.clone(),
        status: "starting".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
        destination_path: destination_path.clone(),
        error: None,
    })
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    let mut continuation_token: Option<String> = None;

    loop {
        let mut request = client
            .list_objects_v2()
            .bucket(&bucket_name)
            .prefix(&prefix)
            .max_keys(1000);

        if let Some(ref token) = continuation_token {
            request = request.continuation_token(token);
        }

        let output = request
            .send()
            .await
            .map_err(|e| format!("S3 error: {e:?}"))?;

        for object in output.contents() {
            let Some(key) = object.key() else { continue };

            if key.ends_with('/') {
                continue;
            }

            let relative_path = key
                .strip_prefix(&prefix)
                .unwrap_or(key)
                .trim_start_matches('/');

            let dest_file_path = format!("{}/{}", destination_path.trim_end_matches('/'), relative_path);

            match download_single_object_for_folder(&app, &client, &bucket_name, key, &dest_file_path).await {
                Ok(_) => files_downloaded += 1,
                Err(_) => files_failed += 1,
            }
        }

        continuation_token = output.next_continuation_token().map(ToString::to_string);

        if continuation_token.is_none() {
            break;
        }
    }

    app.emit("download_progress", DownloadProgressEvent {
        id: folder_id,
        status: "completed".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
        destination_path: destination_path.clone(),
        error: None,
    })
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    Ok(DownloadFolderResult {
        files_downloaded,
        files_failed,
        destination_path,
    })
}

async fn download_single_object_for_folder(
    _app: &tauri::AppHandle,
    client: &S3Client,
    bucket_name: &str,
    key: &str,
    destination_path: &str,
) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    use std::io::Write;
    use tokio::io::AsyncReadExt;

    if let Some(parent) = Path::new(destination_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let get_object_output = client
        .get_object()
        .bucket(bucket_name)
        .key(key)
        .send()
        .await
        .map_err(|e| format!("S3 error: {e:?}"))?;

    let mut file = fs::File::create(destination_path)
        .map_err(|e| format!("Failed to create file: {e}"))?;

    let mut stream = get_object_output.body.into_async_read();
    let mut buffer = vec![0u8; DOWNLOAD_CHUNK_SIZE];

    loop {
        let bytes_read = stream
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read stream: {e}"))?;

        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Failed to write file: {e}"))?;
    }

    file.flush().map_err(|e| format!("Failed to flush file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn s3_open_in_finder(path: String) -> Result<(), String> {
    use std::process::Command;

    Command::new("open")
        .arg("-R")
        .arg(&path)
        .status()
        .map_err(|e| format!("Failed to open in Finder: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| format!("Failed to get home directory: {e}"))?;
    Ok(home)
}
