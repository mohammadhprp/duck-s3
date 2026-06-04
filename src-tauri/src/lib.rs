mod s3;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            s3::s3_list_buckets,
            s3::s3_create_bucket,
            s3::s3_delete_bucket,
            s3::s3_list_objects,
            s3::s3_create_multipart_upload,
            s3::s3_upload_part,
            s3::s3_complete_multipart_upload,
            s3::s3_abort_multipart_upload,
            s3::s3_test_connection,
            s3::s3_get_object_info,
            s3::s3_download_object,
            s3::s3_download_folder,
            s3::s3_open_in_finder,
            s3::get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
