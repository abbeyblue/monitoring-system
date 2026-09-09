# ALB + target group + security groups + ECS service for the CRM Monitor.
# The task definition itself is managed outside Terraform (registered in
# DEPLOY.md Phase 7, updated by CI); this wires the networking and service.
#
#   terraform init && terraform apply
#
# Fill the variables below (or pass -var / a .tfvars file).

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

provider "aws" {
  region = var.region
}

# ---------------- variables ----------------
variable "region" { default = "eu-west-1" }
variable "vpc_id" { type = string }
variable "public_subnet_ids" {
  type        = list(string)
  description = "Two+ public subnets in different AZs for the ALB and the (public-IP) Fargate task."
}
variable "cluster_arn" { type = string }
variable "certificate_arn" {
  type        = string
  description = "ACM cert ARN for HTTPS on the ALB (same region)."
}
variable "allowed_cidrs" {
  type        = list(string)
  description = "Who may reach the dashboard (office IPs / VPN). Do NOT use 0.0.0.0/0."
  default     = []
}
variable "task_family" { default = "crm-monitor" }
variable "desired_count" { default = 1 }

# ---------------- security groups ----------------
resource "aws_security_group" "alb" {
  name        = "crm-monitor-alb"
  description = "CRM Monitor ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from allowlist"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }
  ingress {
    description = "HTTP (redirected to HTTPS) from allowlist"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "service" {
  name        = "crm-monitor-svc"
  description = "CRM Monitor Fargate task"
  vpc_id      = var.vpc_id

  ingress {
    description     = "App port from ALB only"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------------- load balancer ----------------
resource "aws_lb" "this" {
  name               = "crm-monitor"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "this" {
  name        = "crm-monitor"
  port        = 4000
  protocol    = "HTTP"
  target_type = "ip" # Fargate awsvpc
  vpc_id      = var.vpc_id

  health_check {
    path                = "/api/ping"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# ---------------- ECS service ----------------
# Uses whatever revision of the task family is currently registered; CI rolls
# new revisions, so ignore task_definition drift here.
data "aws_ecs_task_definition" "this" {
  task_definition = var.task_family
}

resource "aws_ecs_service" "this" {
  name            = "crm-monitor"
  cluster         = var.cluster_arn
  task_definition = data.aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = "crm-monitor"
    container_port   = 4000
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [task_definition] # CI manages revisions
  }
}

# ---------------- outputs ----------------
output "dashboard_url" {
  value = "https://${aws_lb.this.dns_name}"
}
