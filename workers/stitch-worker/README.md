# Cloud Run Stitch Worker

独立 Cloud Run 服务，负责下载 R2 片段、使用 ffmpeg 拼接、抽帧、上传最终视频和 QA frames，并回调主应用。

正式部署步骤见 `docs/deployment/cloud-run-stitch.md`。
