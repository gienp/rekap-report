#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migrator Otomatis: SQLite (telecom_portal.db) -> PostgreSQL
Telecom Operations Portal - PLN Icon Plus
"""

import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import getpass
import argparse
import sqlite3
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import execute_batch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB = os.path.join(BASE_DIR, "telecom_portal.db")
CONFIG_FILE = os.path.join(BASE_DIR, "db_config.json")

def create_database_if_not_exists(host, port, user, password, dbname):
    print(f"[*] Menghubungi PostgreSQL di {host}:{port} sebagai '{user}'...")
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database="postgres"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
    exists = cur.fetchone()
    if not exists:
        print(f"[+] Membuat database baru: '{dbname}'...")
        cur.execute(f'CREATE DATABASE "{dbname}" WITH ENCODING = \'UTF8\'')
        print(f"[OK] Database '{dbname}' berhasil dibuat.")
    else:
        print(f"[OK] Database '{dbname}' sudah ada.")
        
    cur.close()
    conn.close()

def create_pg_table_from_sqlite(sqlite_conn, pg_conn, table_name):
    s_cur = sqlite_conn.cursor()
    s_cur.execute(f"PRAGMA table_info({table_name})")
    cols = s_cur.fetchall()
    
    col_defs = []
    has_pk = False
    for c in cols:
        col_name = f'"{c[1]}"'
        sql_type = (c[2] or 'TEXT').upper()
        is_pk = c[5] == 1
        
        if is_pk and 'INT' in sql_type:
            col_def = f"{col_name} SERIAL PRIMARY KEY"
            has_pk = True
        elif 'INT' in sql_type:
            col_def = f"{col_name} BIGINT DEFAULT 0"
        elif any(k in sql_type for k in ['REAL', 'FLOAT', 'DOUB', 'NUM']):
            col_def = f"{col_name} DOUBLE PRECISION DEFAULT 0"
        elif any(k in sql_type for k in ['TIME', 'DATE']):
            col_def = f"{col_name} TIMESTAMP"
        else:
            col_def = f"{col_name} TEXT"
        col_defs.append(col_def)
        
    p_cur = pg_conn.cursor()
    # Drop and recreate to guarantee 100% exact schema alignment
    p_cur.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE;')
    create_sql = f'CREATE TABLE "{table_name}" (\n  ' + ",\n  ".join(col_defs) + "\n);"
    p_cur.execute(create_sql)
    
    # Prefix indexes for search performance
    col_names_raw = [c[1] for c in cols]
    for indexed_col in ['sid', 'no_so', 'no_pa', 'pa_number', 'status', 'pengelola', 'pelanggan', 'username', 'email']:
        if indexed_col in col_names_raw:
            try:
                p_cur.execute(f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_{indexed_col}" ON "{table_name}"((left("{indexed_col}", 100)));')
            except Exception:
                pass
                
    pg_conn.commit()
    p_cur.close()
    s_cur.close()

def migrate_table_data(sqlite_conn, pg_conn, table_name, id_col='id'):
    s_cur = sqlite_conn.cursor()
    p_cur = pg_conn.cursor()

    # Buat tabel PG dinamis dari SQLite
    create_pg_table_from_sqlite(sqlite_conn, pg_conn, table_name)

    # Ambil struktur kolom dari SQLite
    s_cur.execute(f"PRAGMA table_info({table_name})")
    cols = [r[1] for r in s_cur.fetchall()]
    cols_str = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))

    # Ambil seluruh baris dari SQLite
    s_cur.execute(f"SELECT {cols_str} FROM {table_name}")
    rows = s_cur.fetchall()

    if rows:
        insert_query = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({placeholders})'
        execute_batch(p_cur, insert_query, rows, page_size=1000)
        pg_conn.commit()

        # Update SERIAL sequence
        try:
            p_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table_name}', '{id_col}'), coalesce(max({id_col}), 1)) FROM \"{table_name}\";")
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()

    p_cur.close()
    s_cur.close()
    return len(rows)

def main():
    print("=" * 65)
    print("  MIGRASI DATABASE TELECOM OPERATIONS PORTAL KE POSTGRESQL")
    print("=" * 65)

    parser = argparse.ArgumentParser(description="Migrate SQLite to PostgreSQL")
    parser.add_argument("--host", default="127.0.0.1", help="Host PostgreSQL (default: 127.0.0.1)")
    parser.add_argument("--port", default="5432", help="Port PostgreSQL (default: 5432)")
    parser.add_argument("--user", default="postgres", help="User PostgreSQL (default: postgres)")
    parser.add_argument("--password", default="", help="Password PostgreSQL user")
    parser.add_argument("--dbname", default="telecom_portal", help="Nama Database (default: telecom_portal)")
    args = parser.parse_args()

    if not os.path.exists(SQLITE_DB):
        print(f"[!] Error: File database SQLite tidak ditemukan di: {SQLITE_DB}")
        sys.exit(1)

    host = args.host
    port = args.port
    user = args.user
    dbname = args.dbname
    password = args.password if args.password is not None else ""

    # Test koneksi otomatis (misal jika trust mode aktif)
    can_connect = False
    try:
        test_c = psycopg2.connect(host=host, port=port, user=user, password=password, database="postgres", connect_timeout=2)
        test_c.close()
        can_connect = True
    except Exception:
        pass

    if not can_connect and not password:
        password = getpass.getpass(f"Masukkan password PostgreSQL untuk user '{user}': ")

    try:
        # 1. Buat database jika belum ada
        create_database_if_not_exists(host, port, user, password, dbname)

        # 2. Hubungkan ke database telecom_portal
        print(f"[*] Menghubungkan ke database '{dbname}'...")
        pg_conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=dbname
        )

        # Cek PostGIS jika ada
        p_cur = pg_conn.cursor()
        try:
            p_cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            pg_conn.commit()
            print("[OK] Ekstensi PostGIS aktif (spatial query ready).")
        except Exception:
            pg_conn.rollback()
            print("[-] PostGIS belum terpasang (menggunakan koordinat standar lat/long).")
        p_cur.close()

        # 3. Migrasi Data Seluruh Tabel
        sqlite_conn = sqlite3.connect(SQLITE_DB)
        tables_to_migrate = [
            'collo_records',
            'sitac_records',
            'network_links',
            'gangguan_records',
            'users',
            'rekap_efisiensi',
            'password_resets'
        ]

        print("\n[*] Memulai transfer data...")
        print("-" * 65)
        print(f"{'Nama Tabel':<22} | {'Baris SQLite':<14} | {'Status':<15}")
        print("-" * 65)

        total_rows = 0
        for tbl in tables_to_migrate:
            count = migrate_table_data(sqlite_conn, pg_conn, tbl)
            total_rows += count
            print(f"{tbl:<22} | {count:<14} | [OK] Sukses")

        print("-" * 65)
        print(f"Total baris data yang berhasil dimigrasikan: {total_rows} baris.")

        # 4. Simpan Konfigurasi Koneksi untuk Backend
        import json
        config_data = {
            "DB_TYPE": "postgresql",
            "PG_HOST": host,
            "PG_PORT": int(port),
            "PG_USER": user,
            "PG_PASSWORD": password,
            "PG_DATABASE": dbname
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
        print(f"[OK] Konfigurasi koneksi disimpan di: {os.path.basename(CONFIG_FILE)}")

        pg_conn.close()
        sqlite_conn.close()

        print("\n" + "=" * 65)
        print("  MIGRASI SELESAI DENGAN SUKSES! Database PostgreSQL Anda Siap Digunakan.")
        print("=" * 65)

    except Exception as e:
        print("\n[!] Terjadi kesalahan saat migrasi:", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
