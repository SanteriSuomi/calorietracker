FROM python:3.14-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl openssh-client jq gnupg \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && curl -LO https://github.com/getsops/sops/releases/download/v3.13.1/sops-v3.13.1.linux.amd64 \
    && mv sops-v3.13.1.linux.amd64 /usr/local/bin/sops \
    && chmod +x /usr/local/bin/sops \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir ansible-core==2.20.4 \
    && ansible-galaxy collection install community.sops community.docker

WORKDIR /ansible
COPY requirements.yml .
RUN ansible-galaxy collection install -r requirements.yml

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
