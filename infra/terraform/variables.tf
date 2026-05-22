variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "s3_uploads_bucket" {
  type        = string
  description = "S3 bucket name for cleaning photo uploads"
}
