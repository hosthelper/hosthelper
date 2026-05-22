terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # backend "s3" {
  #   bucket         = "hosthelper-tf-state"
  #   key            = "infra/terraform.tfstate"
  #   region         = "ap-northeast-2"
  #   dynamodb_table = "hosthelper-tf-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}

# Skeleton: VPC, RDS, ElastiCache, ECS Cluster, ALB, S3, CloudFront.
# 모듈 분리는 다음 PR. 지금은 placeholder.

resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_uploads_bucket
  tags = {
    Project = "hosthelper"
    Env     = var.env
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

# TODO modules:
# - module "vpc"        { source = "./modules/vpc" }
# - module "rds"        { source = "./modules/rds" }
# - module "elasticache"{ source = "./modules/elasticache" }
# - module "ecs"        { source = "./modules/ecs" }
# - module "alb"        { source = "./modules/alb" }
# - module "cloudfront" { source = "./modules/cloudfront" }
# - module "ses"        { source = "./modules/ses" }
