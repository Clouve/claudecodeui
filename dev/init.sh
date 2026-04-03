#!/cloudcli-seed/busybox sh
# Bootstrap: seed empty volumes from image snapshots before starting the server.
# Uses /cloudcli-seed/busybox (a static binary) so this runs even when /usr is
# mounted as an empty volume. On first start it unpacks the seeds and writes a
# sentinel file (.cloudcli-seeded) inside the volume; on subsequent starts the
# sentinel is present so seeding is skipped, preserving any user data (including
# AI clients installed at runtime via the Settings UI).

seed() {
    SENTINEL="$1/.cloudcli-seeded"
    if [ ! -f "$SENTINEL" ]; then
        /cloudcli-seed/busybox printf '[init] Seeding %s ...\n' "$1"
        if /cloudcli-seed/busybox tar xzf "$2" -C /; then
            /cloudcli-seed/busybox touch "$SENTINEL"
            /cloudcli-seed/busybox printf '[init] %s ready.\n' "$1"
        else
            /cloudcli-seed/busybox printf '[init] ERROR: failed to seed %s — will retry on next start.\n' "$1"
        fi
    fi
}

seed /home /cloudcli-seed/home-seed.tar.gz
seed /usr  /cloudcli-seed/usr-seed.tar.gz
seed /var  /cloudcli-seed/var-seed.tar.gz

exec /usr/local/bin/cloudcli-entrypoint.sh "$@"
