#!/ai-workstation-seed/busybox sh
# Bootstrap: seed empty volumes from image snapshots before starting the server.
# Uses /ai-workstation-seed/busybox (a static binary) so this runs even when /usr is
# mounted as an empty volume. On first start it unpacks the seeds and writes a
# sentinel file (.ai-workstation-seeded) inside the volume; on subsequent starts the
# sentinel is present so seeding is skipped, preserving any user data (including
# AI clients installed at runtime via the Settings UI).

seed() {
    SENTINEL="$1/.ai-workstation-seeded"
    if [ ! -f "$SENTINEL" ]; then
        /ai-workstation-seed/busybox printf '[init] Seeding %s ...\n' "$1"
        if /ai-workstation-seed/busybox tar xzf "$2" -C /; then
            /ai-workstation-seed/busybox touch "$SENTINEL"
            /ai-workstation-seed/busybox printf '[init] %s ready.\n' "$1"
        else
            /ai-workstation-seed/busybox printf '[init] ERROR: failed to seed %s — will retry on next start.\n' "$1"
        fi
    fi
}

seed /home /ai-workstation-seed/home-seed.tar.gz
seed /usr  /ai-workstation-seed/usr-seed.tar.gz
seed /var  /ai-workstation-seed/var-seed.tar.gz

exec /usr/local/bin/ai-workstation-entrypoint.sh "$@"
