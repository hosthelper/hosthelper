# Helper Office Render Worker

Public deployment host for the Helper Office event-driven GitHub writer. Runtime secrets are stored only in Render environment variables. The worker accepts one-time Code Job tokens from Helper Office, edits only bound existing files on a working branch, creates Draft PRs, and never auto-deploys Production.
