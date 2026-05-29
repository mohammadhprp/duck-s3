use aws_credential_types::Credentials;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::{
    Client as S3Client,
    config::{BehaviorVersion, Region},
};
use serde::{Deserialize, Serialize};

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
                .location_constraint(
                    aws_sdk_s3::types::BucketLocationConstraint::from(profile.region.as_str()),
                )
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
