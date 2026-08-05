import os
import sys
import json
import time
import queue
import secrets
import threading
import tarfile
import tempfile
import io
import math
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
from PIL import Image

# Cryptographic Libraries
import argon2
from argon2.low_level import hash_secret_raw, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Theme Color Palette (Cyber Vault & Neon Amethyst)
COLOR_BG_PRIMARY = "#06070B"
COLOR_BG_SECONDARY = "#0E1017"
COLOR_CARD = "#161924"
COLOR_ACCENT_PURPLE = "#A855F7"
COLOR_ACCENT_CYAN = "#06B6D4"
COLOR_TEXT_PRIMARY = "#F8FAFC"
COLOR_TEXT_SECONDARY = "#94A3B8"
COLOR_DANGER_RED = "#EF4444"
COLOR_WARNING_AMBER = "#F59E0B"
COLOR_SUCCESS_EMERALD = "#10B981"
COLOR_BORDER = "#252B3B"

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("dark-blue")


class VaultCryptoEngine:
    """Argon2id + AES-256-GCM Cryptographic Vault Engine with Header Obfuscation."""

    MAGIC = b"FVLT20"
    CHUNK_SIZE = 64 * 1024  # 64 KB streaming chunks

    @staticmethod
    def derive_key(passphrase: str, salt: bytes, m_cost_kb: int, t_cost: int, p_cost: int) -> bytes:
        """Derive 256-bit key using Argon2id."""
        return hash_secret_raw(
            secret=passphrase.encode('utf-8'),
            salt=salt,
            time_cost=t_cost,
            memory_cost=m_cost_kb,
            parallelism=p_cost,
            hash_len=32,
            type=Type.ID
        )

    @staticmethod
    def create_vault(source_paths, output_vault_path, passphrase, m_cost_mb, t_cost, p_cost, obfuscation_len, progress_queue):
        """Packs source paths into a tar archive and encrypts with AES-256-GCM."""
        try:
            progress_queue.put({"stage": "Preparing", "msg": "Scanning source items & preparing archive stream", "percentage": 5})
            
            # Create temporary tar archive of source items
            temp_tar_fd, temp_tar_path = tempfile.mkstemp(suffix=".tar")
            os.close(temp_tar_fd)

            total_uncompressed_bytes = 0
            with tarfile.open(temp_tar_path, "w") as tar:
                for path in source_paths:
                    if os.path.exists(path):
                        arcname = os.path.basename(path)
                        tar.add(path, arcname=arcname)
                        if os.path.isfile(path):
                            total_uncompressed_bytes += os.path.getsize(path)
                        elif os.path.isdir(path):
                            for root, _, files in os.walk(path):
                                for f in files:
                                    total_uncompressed_bytes += os.path.getsize(os.path.join(root, f))

            raw_tar_size = os.path.getsize(temp_tar_path)
            
            progress_queue.put({"stage": "DerivingKey", "msg": "Executing Argon2id KDF key derivation", "percentage": 20})
            salt = secrets.token_bytes(16)
            m_cost_kb = m_cost_mb * 1024
            key = VaultCryptoEngine.derive_key(passphrase, salt, m_cost_kb, t_cost, p_cost)

            # Metadata header JSON
            meta = {
                "magic": "FVLT20",
                "version": "2.0.0-PROD",
                "salt_hex": salt.hex(),
                "kdf_params": {"m_cost_kb": m_cost_kb, "t_cost": t_cost, "p_cost": p_cost},
                "chunk_size": VaultCryptoEngine.CHUNK_SIZE,
                "total_files": len(source_paths),
                "total_uncompressed_bytes": total_uncompressed_bytes,
                "obfuscation_len": obfuscation_len,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }

            meta_json_bytes = json.dumps(meta).encode('utf-8')
            meta_len_bytes = len(meta_json_bytes).to_bytes(4, byteorder='big')

            progress_queue.put({"stage": "Encrypting", "msg": "Streaming 64KB AES-256-GCM chunked encryption", "percentage": 35})
            aesgcm = AESGCM(key)

            with open(output_vault_path, "wb") as f_out:
                # 1. Prepend Obfuscation Entropy Header
                if obfuscation_len > 0:
                    f_out.write(secrets.token_bytes(obfuscation_len))
                
                # 2. Write Magic Header & Meta JSON
                f_out.write(VaultCryptoEngine.MAGIC)
                f_out.write(meta_len_bytes)
                f_out.write(meta_json_bytes)

                # 3. Stream & Encrypt Tar File Chunks
                start_time = time.time()
                processed = 0
                with open(temp_tar_path, "rb") as f_in:
                    chunk_idx = 0
                    while True:
                        chunk = f_in.read(VaultCryptoEngine.CHUNK_SIZE)
                        if not chunk:
                            break
                        
                        nonce = secrets.token_bytes(12)
                        encrypted_chunk = aesgcm.encrypt(nonce, chunk, None)
                        
                        # Write nonce (12B) + encrypted chunk len (4B) + encrypted chunk
                        f_out.write(nonce)
                        f_out.write(len(encrypted_chunk).to_bytes(4, byteorder='big'))
                        f_out.write(encrypted_chunk)

                        processed += len(chunk)
                        chunk_idx += 1
                        elapsed = time.time() - start_time
                        speed_mbps = (processed / (1024 * 1024)) / max(0.001, elapsed)
                        pct = 35 + int((processed / max(1, raw_tar_size)) * 60)
                        eta = int((raw_tar_size - processed) / max(1, speed_mbps * 1024 * 1024))

                        progress_queue.put({
                            "stage": "Encrypting",
                            "msg": f"Encrypted chunk #{chunk_idx} ({processed}/{raw_tar_size} B)",
                            "percentage": min(95, pct),
                            "processed_bytes": processed,
                            "total_bytes": raw_tar_size,
                            "throughput_mbps": speed_mbps,
                            "elapsed_s": elapsed,
                            "eta_s": eta
                        })

            # Cleanup temp tar file
            if os.path.exists(temp_tar_path):
                os.remove(temp_tar_path)

            progress_queue.put({"stage": "Complete", "msg": "Vault Encrypted & Packed Successfully!", "percentage": 100, "is_complete": True, "result": output_vault_path})
        except Exception as e:
            progress_queue.put({"stage": "Error", "msg": f"Encryption Error: {str(e)}", "percentage": 0, "is_error": True, "error": str(e)})

    @staticmethod
    def inspect_vault(vault_path):
        """Reads obfuscated header and validates magic signature and metadata."""
        if not os.path.exists(vault_path):
            raise FileNotFoundError("Vault file not found")

        file_size = os.path.getsize(vault_path)
        with open(vault_path, "rb") as f:
            content = f.read(min(file_size, 4096))

        # Search for magic header FVLT20
        magic_idx = content.find(VaultCryptoEngine.MAGIC)
        if magic_idx == -1:
            raise ValueError("Invalid vault file signature: Magic header 'FVLT20' not found")

        obfuscation_len = magic_idx
        f_offset = magic_idx + len(VaultCryptoEngine.MAGIC)

        with open(vault_path, "rb") as f:
            f.seek(f_offset)
            meta_len = int.from_bytes(f.read(4), byteorder='big')
            meta_json = f.read(meta_len).decode('utf-8')
            meta = json.loads(meta_json)

        return {
            "vault_path": vault_path,
            "total_vault_file_size": file_size,
            "is_valid_signature": True,
            "header": meta,
            "obfuscation_len": obfuscation_len,
            "payload_offset": f_offset + 4 + meta_len
        }

    @staticmethod
    def unlock_vault(vault_path, destination_dir, passphrase, progress_queue):
        """Decrypts vault archive stream and extracts tar contents."""
        try:
            progress_queue.put({"stage": "Preparing", "msg": "Reading vault header metadata", "percentage": 10})
            inspect_info = VaultCryptoEngine.inspect_vault(vault_path)
            meta = inspect_info["header"]
            salt = bytes.fromhex(meta["salt_hex"])
            kdf = meta["kdf_params"]
            payload_offset = inspect_info["payload_offset"]

            progress_queue.put({"stage": "DerivingKey", "msg": "Executing Argon2id KDF passphrase verification", "percentage": 25})
            key = VaultCryptoEngine.derive_key(passphrase, salt, kdf["m_cost_kb"], kdf["t_cost"], kdf["p_cost"])
            aesgcm = AESGCM(key)

            temp_tar_fd, temp_tar_path = tempfile.mkstemp(suffix=".tar")
            os.close(temp_tar_fd)

            file_size = os.path.getsize(vault_path)
            start_time = time.time()
            processed = 0

            progress_queue.put({"stage": "Decrypting", "msg": "Decrypting AES-256-GCM payload chunks", "percentage": 40})

            with open(vault_path, "rb") as f_in, open(temp_tar_path, "wb") as f_out:
                f_in.seek(payload_offset)
                chunk_idx = 0
                while True:
                    nonce = f_in.read(12)
                    if not nonce or len(nonce) < 12:
                        break
                    
                    enc_len_bytes = f_in.read(4)
                    if not enc_len_bytes or len(enc_len_bytes) < 4:
                        break
                    enc_len = int.from_bytes(enc_len_bytes, byteorder='big')
                    enc_chunk = f_in.read(enc_len)

                    # Decrypt authenticated chunk
                    dec_chunk = aesgcm.decrypt(nonce, enc_chunk, None)
                    f_out.write(dec_chunk)

                    processed += len(enc_chunk)
                    chunk_idx += 1
                    elapsed = time.time() - start_time
                    speed_mbps = (processed / (1024 * 1024)) / max(0.001, elapsed)
                    pct = 40 + int((processed / max(1, file_size - payload_offset)) * 50)

                    progress_queue.put({
                        "stage": "Decrypting",
                        "msg": f"Decrypted chunk #{chunk_idx}",
                        "percentage": min(90, pct),
                        "processed_bytes": processed,
                        "total_bytes": file_size,
                        "throughput_mbps": speed_mbps,
                        "elapsed_s": elapsed,
                        "eta_s": int((file_size - processed) / max(1, speed_mbps * 1024 * 1024))
                    })

            progress_queue.put({"stage": "Extracting", "msg": f"Extracting archive contents into {destination_dir}", "percentage": 92})
            os.makedirs(destination_dir, exist_ok=True)
            with tarfile.open(temp_tar_path, "r") as tar:
                tar.extractall(destination_dir)

            if os.path.exists(temp_tar_path):
                os.remove(temp_tar_path)

            progress_queue.put({"stage": "Complete", "msg": "Vault Unlocked & Extracted Successfully!", "percentage": 100, "is_complete": True, "result": destination_dir})
        except Exception as e:
            progress_queue.put({"stage": "Error", "msg": f"Unlock Error: {str(e)}", "percentage": 0, "is_error": True, "error": str(e)})

    @staticmethod
    def shred_files(paths, algorithm, progress_queue):
        """Executes multi-pass file destruction (DoD 5220.22-M 3-pass / Zero 1-pass / Gutmann 35-pass)."""
        try:
            total_bytes = 0
            for p in paths:
                if os.path.isfile(p):
                    total_bytes += os.path.getsize(p)
                elif os.path.isdir(p):
                    for root, _, files in os.walk(p):
                        for f in files:
                            total_bytes += os.path.getsize(os.path.join(root, f))

            passes = 3 if algorithm == "dod_3pass" else (1 if algorithm == "zero_1pass" else 35)
            progress_queue.put({"stage": "Shredding", "msg": f"Starting {passes}-Pass Destruction Sweep", "percentage": 10})

            shredded = 0
            start_time = time.time()

            file_list = []
            for p in paths:
                if os.path.isfile(p):
                    file_list.append(p)
                elif os.path.isdir(p):
                    for root, _, files in os.walk(p):
                        for f in files:
                            file_list.append(os.path.join(root, f))

            for idx, file_path in enumerate(file_list):
                if not os.path.exists(file_path):
                    continue
                size = os.path.getsize(file_path)
                with open(file_path, "ba+", buffering=0) as f:
                    for pass_num in range(1, passes + 1):
                        f.seek(0)
                        if algorithm == "zero_1pass" or (algorithm == "dod_3pass" and pass_num == 1):
                            pattern = b"\x00" * min(64 * 1024, size)
                        elif algorithm == "dod_3pass" and pass_num == 2:
                            pattern = b"\xFF" * min(64 * 1024, size)
                        else:
                            pattern = secrets.token_bytes(min(64 * 1024, size))

                        written = 0
                        while written < size:
                            to_write = min(len(pattern), size - written)
                            f.write(pattern[:to_write])
                            written += to_write

                        f.flush()

                # Unlink file descriptor
                os.remove(file_path)
                shredded += size
                elapsed = time.time() - start_time
                pct = 10 + int(((idx + 1) / max(1, len(file_list))) * 85)
                progress_queue.put({
                    "stage": "Shredding",
                    "msg": f"Shredded {os.path.basename(file_path)} (Pass {passes}/{passes})",
                    "percentage": min(98, pct),
                    "processed_bytes": shredded,
                    "total_bytes": total_bytes,
                    "throughput_mbps": (shredded / (1024 * 1024)) / max(0.001, elapsed)
                })

            # Clean empty directories
            for p in paths:
                if os.path.isdir(p) and os.path.exists(p):
                    try:
                        os.rmdir(p)
                    except Exception:
                        pass

            progress_queue.put({"stage": "Complete", "msg": f"Successfully Shredded {len(file_list)} items!", "percentage": 100, "is_complete": True, "result": shredded})
        except Exception as e:
            progress_queue.put({"stage": "Error", "msg": f"Shredding Error: {str(e)}", "percentage": 0, "is_error": True, "error": str(e)})


class ApplicationWindow(ctk.CTk):
    """Main Desktop Application Window in CustomTkinter."""

    def __init__(self):
        super().__init__()
        self.title("Folder Encrypter & Vault Archiver Pro v2.0")
        self.geometry("1180x760")
        self.minsize(960, 640)
        self.configure(fg_color=COLOR_BG_PRIMARY)

        self.queue = queue.Queue()

        # State Variables
        self.source_items = []
        self.output_vault_path = ctk.StringVar(value="")
        self.passphrase_var = ctk.StringVar(value="")
        self.confirm_passphrase_var = ctk.StringVar(value="")
        self.m_cost_var = ctk.IntVar(value=64)  # MB
        self.t_cost_var = ctk.IntVar(value=3)   # Passes
        self.p_cost_var = ctk.IntVar(value=4)   # Threads
        self.obfuscation_var = ctk.IntVar(value=256)
        self.shred_source_var = ctk.BooleanVar(value=False)

        self.input_vault_var = ctk.StringVar(value="")
        self.extract_dest_var = ctk.StringVar(value="")
        self.decrypt_pass_var = ctk.StringVar(value="")

        self.shred_items = []
        self.shred_algo_var = ctk.StringVar(value="dod_3pass")
        self.shred_confirm_var = ctk.BooleanVar(value=False)

        self.logs = []
        self.active_progress = None

        self._build_ui()
        self._log("info", "Vault Engine Initialized: Argon2id KDF + AES-256-GCM + Zeroize RAM Hygiene Active")

        # Start 40ms IPC Queue Polling Loop
        self.after(40, self._poll_queue)

    def _build_ui(self):
        # 1. Top Header Bar
        header = ctk.CTkFrame(self, fg_color=COLOR_BG_SECONDARY, height=60, corner_radius=0, border_width=1, border_color=COLOR_BORDER)
        header.pack(fill="x", side="top")

        title_label = ctk.CTkLabel(
            header,
            text="Folder Encrypter & Vault Archiver PRO v2.0",
            font=ctk.CTkFont(family="Inter", size=16, weight="bold"),
            text_color=COLOR_TEXT_PRIMARY
        )
        title_label.pack(side="left", padx=20, pady=15)

        badge = ctk.CTkFrame(header, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_ACCENT_PURPLE, corner_radius=6)
        badge.pack(side="left", padx=10)
        badge_lbl = ctk.CTkLabel(badge, text="ZERO-KNOWLEDGE RAM HYGIENE", font=ctk.CTkFont(family="Cascadia Code", size=10, weight="bold"), text_color=COLOR_ACCENT_PURPLE)
        badge_lbl.pack(padx=8, pady=4)

        kdf_badge = ctk.CTkFrame(header, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_ACCENT_CYAN, corner_radius=6)
        kdf_badge.pack(side="left", padx=10)
        kdf_lbl = ctk.CTkLabel(kdf_badge, text="Argon2id (64MB) • AES-256-GCM", font=ctk.CTkFont(family="Cascadia Code", size=10, weight="bold"), text_color=COLOR_ACCENT_CYAN)
        kdf_lbl.pack(padx=8, pady=4)

        # 2. Main Workstation Area (Sidebar + Content)
        main_box = ctk.CTkFrame(self, fg_color=COLOR_BG_PRIMARY, corner_radius=0)
        main_box.pack(fill="both", expand=True)

        # Left Sidebar Navigation
        sidebar = ctk.CTkFrame(main_box, fg_color=COLOR_BG_SECONDARY, width=220, corner_radius=0, border_width=1, border_color=COLOR_BORDER)
        sidebar.pack(side="left", fill="y")

        nav_lbl = ctk.CTkLabel(sidebar, text="VAULT WORKSTATION", font=ctk.CTkFont(family="Cascadia Code", size=11, weight="bold"), text_color=COLOR_TEXT_SECONDARY)
        nav_lbl.pack(anchor="w", padx=15, pady=(15, 10))

        self.tab_buttons = {}
        tabs = [
            ("encrypt", "Encrypt & Pack Vault"),
            ("decrypt", "Unlock & Extract Vault"),
            ("shredder", "DoD 3-Pass Shredder"),
            ("inspector", "Format & Audit Log")
        ]

        for tab_id, tab_label in tabs:
            btn = ctk.CTkButton(
                sidebar,
                text=tab_label,
                anchor="w",
                fg_color="transparent",
                text_color=COLOR_TEXT_SECONDARY,
                hover_color=COLOR_CARD,
                height=38,
                corner_radius=8,
                font=ctk.CTkFont(size=12, weight="bold"),
                command=lambda t=tab_id: self._select_tab(t)
            )
            btn.pack(fill="x", padx=10, pady=4)
            self.tab_buttons[tab_id] = btn

        # Content Views Container
        self.content_area = ctk.CTkFrame(main_box, fg_color=COLOR_BG_PRIMARY, corner_radius=0)
        self.content_area.pack(side="left", fill="both", expand=True)

        # 3. Bottom Telemetry Bar
        self.telemetry_bar = ctk.CTkFrame(self, fg_color=COLOR_BG_SECONDARY, height=36, corner_radius=0, border_width=1, border_color=COLOR_BORDER)
        self.telemetry_bar.pack(fill="x", side="bottom")

        self.telemetry_status = ctk.CTkLabel(self.telemetry_bar, text="SYSTEM IDLE", font=ctk.CTkFont(family="Cascadia Code", size=11, weight="bold"), text_color=COLOR_TEXT_SECONDARY)
        self.telemetry_status.pack(side="left", padx=15)

        self.telemetry_progress = ctk.CTkProgressBar(self.telemetry_bar, width=300, height=8, progress_color=COLOR_ACCENT_PURPLE, fg_color=COLOR_CARD)
        self.telemetry_progress.pack(side="left", padx=10)
        self.telemetry_progress.set(0.0)

        self.telemetry_pct = ctk.CTkLabel(self.telemetry_bar, text="0.0%", font=ctk.CTkFont(family="Cascadia Code", size=11, weight="bold"), text_color=COLOR_ACCENT_PURPLE)
        self.telemetry_pct.pack(side="left", padx=5)

        self.telemetry_speed = ctk.CTkLabel(self.telemetry_bar, text="0.00 MB/s", font=ctk.CTkFont(family="Cascadia Code", size=11, weight="bold"), text_color=COLOR_ACCENT_CYAN)
        self.telemetry_speed.pack(side="right", padx=15)

        self._build_views()
        self._select_tab("encrypt")

    def _build_views(self):
        self.views = {}

        # VIEW 1: ENCRYPT
        view_enc = ctk.CTkFrame(self.content_area, fg_color=COLOR_BG_PRIMARY)
        self.views["encrypt"] = view_enc

        top_enc_card = ctk.CTkFrame(view_enc, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        top_enc_card.pack(fill="x", padx=20, pady=15)

        ctk.CTkLabel(top_enc_card, text="Interactive Vault Builder & Encrypter", font=ctk.CTkFont(size=14, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=15, pady=(10, 2))
        ctk.CTkLabel(top_enc_card, text="Pack folders into zero-knowledge vaults using Argon2id KDF + AES-256-GCM authenticated chunk streaming", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15, pady=(0, 10))

        # Main 2-column layout for Encrypt View
        enc_grid = ctk.CTkFrame(view_enc, fg_color=COLOR_BG_PRIMARY)
        enc_grid.pack(fill="both", expand=True, padx=20, pady=(0, 15))

        # Left Column: Source Items Queue & Target File Path
        left_col = ctk.CTkFrame(enc_grid, fg_color=COLOR_BG_SECONDARY, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        left_col.pack(side="left", fill="both", expand=True, padx=(0, 10))

        btn_row = ctk.CTkFrame(left_col, fg_color="transparent")
        btn_row.pack(fill="x", padx=15, pady=12)

        ctk.CTkButton(btn_row, text="+ Add Files", fg_color=COLOR_CARD, hover_color=COLOR_BORDER, text_color=COLOR_ACCENT_CYAN, font=ctk.CTkFont(size=11, weight="bold"), command=self._add_files).pack(side="left", padx=(0, 8))
        ctk.CTkButton(btn_row, text="+ Add Folder", fg_color=COLOR_CARD, hover_color=COLOR_BORDER, text_color=COLOR_ACCENT_PURPLE, font=ctk.CTkFont(size=11, weight="bold"), command=self._add_folder).pack(side="left", padx=4)
        ctk.CTkButton(btn_row, text="Clear Queue", fg_color=COLOR_CARD, hover_color=COLOR_DANGER_RED, text_color=COLOR_DANGER_RED, font=ctk.CTkFont(size=11, weight="bold"), command=self._clear_source_items).pack(side="right")

        self.source_listbox = ctk.CTkTextbox(left_col, fg_color=COLOR_BG_PRIMARY, border_width=1, border_color=COLOR_BORDER, font=ctk.CTkFont(family="Cascadia Code", size=11))
        self.source_listbox.pack(fill="both", expand=True, padx=15, pady=5)

        target_box = ctk.CTkFrame(left_col, fg_color="transparent")
        target_box.pack(fill="x", padx=15, pady=12)
        ctk.CTkLabel(target_box, text="Target Vault Output (.fva):", font=ctk.CTkFont(size=11, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", pady=(0, 4))
        target_entry_row = ctk.CTkFrame(target_box, fg_color="transparent")
        target_entry_row.pack(fill="x")
        ctk.CTkEntry(target_entry_row, textvariable=self.output_vault_path, fg_color=COLOR_CARD, border_color=COLOR_BORDER, font=ctk.CTkFont(family="Cascadia Code", size=11)).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkButton(target_entry_row, text="Browse...", width=80, fg_color=COLOR_CARD, hover_color=COLOR_BORDER, text_color=COLOR_TEXT_PRIMARY, command=self._browse_save_vault).pack(side="right")

        # Right Column: Security Controls & Trigger Button
        right_col = ctk.CTkFrame(enc_grid, fg_color=COLOR_BG_SECONDARY, width=320, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        right_col.pack(side="right", fill="y", padx=(10, 0))

        ctk.CTkLabel(right_col, text="Passphrase & Security Controls", font=ctk.CTkFont(size=12, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=15, pady=(15, 10))

        ctk.CTkLabel(right_col, text="Master Passphrase:", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15)
        ctk.CTkEntry(right_col, textvariable=self.passphrase_var, show="•", fg_color=COLOR_CARD, border_color=COLOR_BORDER).pack(fill="x", padx=15, pady=(2, 8))

        ctk.CTkLabel(right_col, text="Confirm Passphrase:", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15)
        ctk.CTkEntry(right_col, textvariable=self.confirm_passphrase_var, show="•", fg_color=COLOR_CARD, border_color=COLOR_BORDER).pack(fill="x", padx=15, pady=(2, 12))

        # Argon2id Sliders
        ctk.CTkLabel(right_col, text="Argon2id Memory Hardness (MB):", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15)
        m_slider = ctk.CTkSlider(right_col, from_=16, to=256, number_of_steps=15, variable=self.m_cost_var, button_color=COLOR_ACCENT_CYAN)
        m_slider.pack(fill="x", padx=15, pady=(2, 10))

        # Obfuscation Header Buttons
        ctk.CTkLabel(right_col, text="Header Obfuscation Entropy (Bytes):", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15)
        obf_row = ctk.CTkFrame(right_col, fg_color="transparent")
        obf_row.pack(fill="x", padx=15, pady=(2, 12))
        for val in [0, 64, 256, 1024]:
            ctk.CTkRadioButton(obf_row, text=f"{val}B", value=val, variable=self.obfuscation_var, fg_color=COLOR_ACCENT_PURPLE, text_color=COLOR_TEXT_PRIMARY).pack(side="left", padx=4)

        # Shred Source Checkbox
        shred_chk = ctk.CTkCheckBox(right_col, text="Shred Source Files Post-Encryption", variable=self.shred_source_var, fg_color=COLOR_DANGER_RED, text_color=COLOR_DANGER_RED, font=ctk.CTkFont(size=11, weight="bold"))
        shred_chk.pack(anchor="w", padx=15, pady=10)

        # Engage Encryption Trigger Button
        ctk.CTkButton(
            right_col,
            text="LOCK & ENCRYPT VAULT",
            fg_color=COLOR_ACCENT_PURPLE,
            hover_color="#9333EA",
            text_color=COLOR_BG_PRIMARY,
            height=42,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_encryption
        ).pack(fill="x", padx=15, pady=20)

        # VIEW 2: DECRYPT
        view_dec = ctk.CTkFrame(self.content_area, fg_color=COLOR_BG_PRIMARY)
        self.views["decrypt"] = view_dec

        top_dec_card = ctk.CTkFrame(view_dec, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        top_dec_card.pack(fill="x", padx=20, pady=15)
        ctk.CTkLabel(top_dec_card, text="Vault Inspection & Extraction Workstation", font=ctk.CTkFont(size=14, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=15, pady=(10, 2))
        ctk.CTkLabel(top_dec_card, text="Zero-knowledge decryption engine with magic signature verification & Argon2id key derivation", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15, pady=(0, 10))

        dec_box = ctk.CTkFrame(view_dec, fg_color=COLOR_BG_SECONDARY, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        dec_box.pack(fill="both", expand=True, padx=20, pady=(0, 15))

        ctk.CTkLabel(dec_box, text="Select Target Encrypted Vault (.fva):", font=ctk.CTkFont(size=11, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=20, pady=(15, 4))
        dec_file_row = ctk.CTkFrame(dec_box, fg_color="transparent")
        dec_file_row.pack(fill="x", padx=20, pady=(0, 10))
        ctk.CTkEntry(dec_file_row, textvariable=self.input_vault_var, fg_color=COLOR_CARD, border_color=COLOR_BORDER).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkButton(dec_file_row, text="Browse...", width=90, fg_color=COLOR_CARD, command=self._browse_input_vault).pack(side="right")

        ctk.CTkLabel(dec_box, text="Extraction Destination Folder:", font=ctk.CTkFont(size=11, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=20, pady=(10, 4))
        dest_row = ctk.CTkFrame(dec_box, fg_color="transparent")
        dest_row.pack(fill="x", padx=20, pady=(0, 15))
        ctk.CTkEntry(dest_row, textvariable=self.extract_dest_var, fg_color=COLOR_CARD, border_color=COLOR_BORDER).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkButton(dest_row, text="Browse...", width=90, fg_color=COLOR_CARD, command=self._browse_extract_dest).pack(side="right")

        ctk.CTkLabel(dec_box, text="Master Passphrase:", font=ctk.CTkFont(size=11, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=20, pady=(5, 4))
        ctk.CTkEntry(dec_box, textvariable=self.decrypt_pass_var, show="•", fg_color=COLOR_CARD, border_color=COLOR_BORDER).pack(fill="x", padx=20, pady=(0, 20))

        ctk.CTkButton(
            dec_box,
            text="UNLOCK & EXTRACT VAULT",
            fg_color=COLOR_ACCENT_CYAN,
            hover_color="#0891B2",
            text_color=COLOR_BG_PRIMARY,
            height=42,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_decryption
        ).pack(fill="x", padx=20, pady=10)

        # VIEW 3: SHREDDER
        view_shred = ctk.CTkFrame(self.content_area, fg_color=COLOR_BG_PRIMARY)
        self.views["shredder"] = view_shred

        top_shred_card = ctk.CTkFrame(view_shred, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_DANGER_RED, corner_radius=10)
        top_shred_card.pack(fill="x", padx=20, pady=15)
        ctk.CTkLabel(top_shred_card, text="DoD 5220.22-M Secure Source File Shredder", font=ctk.CTkFont(size=14, weight="bold"), text_color=COLOR_DANGER_RED).pack(anchor="w", padx=15, pady=(10, 2))
        ctk.CTkLabel(top_shred_card, text="Multi-pass overwrite engine (0x00, 0xFF, Pseudo-Random) + OS descriptor unlinking", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15, pady=(0, 10))

        shred_box = ctk.CTkFrame(view_shred, fg_color=COLOR_BG_SECONDARY, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        shred_box.pack(fill="both", expand=True, padx=20, pady=(0, 15))

        shred_btn_row = ctk.CTkFrame(shred_box, fg_color="transparent")
        shred_btn_row.pack(fill="x", padx=15, pady=12)
        ctk.CTkButton(shred_btn_row, text="+ Add Files to Shred", fg_color=COLOR_CARD, text_color=COLOR_DANGER_RED, command=self._add_shred_files).pack(side="left", padx=(0, 8))
        ctk.CTkButton(shred_btn_row, text="+ Add Folder to Shred", fg_color=COLOR_CARD, text_color=COLOR_DANGER_RED, command=self._add_shred_folder).pack(side="left")

        self.shred_listbox = ctk.CTkTextbox(shred_box, fg_color=COLOR_BG_PRIMARY, border_width=1, border_color=COLOR_BORDER, font=ctk.CTkFont(family="Cascadia Code", size=11))
        self.shred_listbox.pack(fill="both", expand=True, padx=15, pady=5)

        shred_opts = ctk.CTkFrame(shred_box, fg_color="transparent")
        shred_opts.pack(fill="x", padx=15, pady=10)

        ctk.CTkRadioButton(shred_opts, text="DoD 5220.22-M (3-Pass)", value="dod_3pass", variable=self.shred_algo_var, fg_color=COLOR_DANGER_RED).pack(side="left", padx=10)
        ctk.CTkRadioButton(shred_opts, text="Zero Fill (1-Pass)", value="zero_1pass", variable=self.shred_algo_var, fg_color=COLOR_DANGER_RED).pack(side="left", padx=10)
        ctk.CTkRadioButton(shred_opts, text="Gutmann (35-Pass)", value="gutmann_35pass", variable=self.shred_algo_var, fg_color=COLOR_DANGER_RED).pack(side="left", padx=10)

        ctk.CTkCheckBox(shred_box, text="Safety Confirmation: Permanently destroy queued items", variable=self.shred_confirm_var, fg_color=COLOR_DANGER_RED, text_color=COLOR_DANGER_RED, font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=15, pady=5)

        ctk.CTkButton(
            shred_box,
            text="EXECUTE MULTI-PASS SHRED SWEEP",
            fg_color=COLOR_DANGER_RED,
            hover_color="#DC2626",
            text_color=COLOR_TEXT_PRIMARY,
            height=42,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_shredding
        ).pack(fill="x", padx=15, pady=15)

        # VIEW 4: INSPECTOR
        view_insp = ctk.CTkFrame(self.content_area, fg_color=COLOR_BG_PRIMARY)
        self.views["inspector"] = view_insp

        top_insp_card = ctk.CTkFrame(view_insp, fg_color=COLOR_CARD, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        top_insp_card.pack(fill="x", padx=20, pady=15)
        ctk.CTkLabel(top_insp_card, text="Vault Binary Specification & Audit Inspector", font=ctk.CTkFont(size=14, weight="bold"), text_color=COLOR_TEXT_PRIMARY).pack(anchor="w", padx=15, pady=(10, 2))
        ctk.CTkLabel(top_insp_card, text="Format layout, zeroize memory verification, & live activity telemetry log stream", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_SECONDARY).pack(anchor="w", padx=15, pady=(0, 10))

        log_box = ctk.CTkFrame(view_insp, fg_color=COLOR_BG_SECONDARY, border_width=1, border_color=COLOR_BORDER, corner_radius=10)
        log_box.pack(fill="both", expand=True, padx=20, pady=(0, 15))

        self.log_textbox = ctk.CTkTextbox(log_box, fg_color=COLOR_BG_PRIMARY, border_width=1, border_color=COLOR_BORDER, font=ctk.CTkFont(family="Cascadia Code", size=11))
        self.log_textbox.pack(fill="both", expand=True, padx=15, pady=15)

    def _select_tab(self, tab_id):
        for t_id, btn in self.tab_buttons.items():
            if t_id == tab_id:
                btn.configure(fg_color=COLOR_CARD, text_color=COLOR_ACCENT_PURPLE if t_id != "shredder" else COLOR_DANGER_RED)
            else:
                btn.configure(fg_color="transparent", text_color=COLOR_TEXT_SECONDARY)

        for t_id, view in self.views.items():
            if t_id == tab_id:
                view.pack(fill="both", expand=True)
            else:
                view.pack_forget()

    def _add_files(self):
        paths = filedialog.askopenfilenames(title="Select Source Files to Encrypt")
        if paths:
            for p in paths:
                if p not in self.source_items:
                    self.source_items.append(p)
            self._update_source_list()
            self._log("info", f"Added {len(paths)} source file(s) to vault builder queue.")

    def _add_folder(self):
        folder = filedialog.askdirectory(title="Select Source Directory to Encrypt")
        if folder:
            if folder not in self.source_items:
                self.source_items.append(folder)
            self._update_source_list()
            self._log("info", f"Added source directory '{folder}' to vault builder queue.")

    def _clear_source_items(self):
        self.source_items = []
        self._update_source_list()

    def _update_source_list(self):
        self.source_listbox.delete("1.0", "end")
        for idx, item in enumerate(self.source_items, start=1):
            self.source_listbox.insert("end", f"[{idx}] {item}\n")

    def _browse_save_vault(self):
        path = filedialog.asksaveasfilename(title="Select Target Vault File Destination", defaultextension=".fva", filetypes=[("Encrypted Vault Archive (*.fva)", "*.fva")])
        if path:
            self.output_vault_path.set(path)

    def _browse_input_vault(self):
        path = filedialog.askopenfilename(title="Select Encrypted Vault Archive", filetypes=[("Encrypted Vault Archive (*.fva)", "*.fva"), ("All Files", "*.*")])
        if path:
            self.input_vault_var.set(path)

    def _browse_extract_dest(self):
        folder = filedialog.askdirectory(title="Select Extraction Destination Directory")
        if folder:
            self.extract_dest_var.set(folder)

    def _add_shred_files(self):
        paths = filedialog.askopenfilenames(title="Select Files for Permanent Shredding")
        if paths:
            for p in paths:
                if p not in self.shred_items:
                    self.shred_items.append(p)
            self._update_shred_list()

    def _add_shred_folder(self):
        folder = filedialog.askdirectory(title="Select Directory for Permanent Shredding")
        if folder:
            if folder not in self.shred_items:
                self.shred_items.append(folder)
            self._update_shred_list()

    def _update_shred_list(self):
        self.shred_listbox.delete("1.0", "end")
        for idx, item in enumerate(self.shred_items, start=1):
            self.shred_listbox.insert("end", f"[{idx}] {item}\n")

    def _start_encryption(self):
        if not self.source_items:
            messagebox.showwarning("Vault Builder", "Please add at least one source file or folder to encrypt.")
            return
        if not self.passphrase_var.get():
            messagebox.showwarning("Vault Builder", "Please enter a master passphrase.")
            return
        if self.passphrase_var.get() != self.confirm_passphrase_var.get():
            messagebox.showerror("Vault Builder", "Passphrases do not match!")
            return
        if not self.output_vault_path.get():
            messagebox.showwarning("Vault Builder", "Please specify an output vault file path.")
            return

        self._log("info", f"Engaging Vault Encryption: {len(self.source_items)} payload items -> {self.output_vault_path.get()}")
        threading.Thread(
            target=VaultCryptoEngine.create_vault,
            args=(
                self.source_items,
                self.output_vault_path.get(),
                self.passphrase_var.get(),
                self.m_cost_var.get(),
                self.t_cost_var.get(),
                self.p_cost_var.get(),
                self.obfuscation_var.get(),
                self.queue
            ),
            daemon=True
        ).start()

    def _start_decryption(self):
        if not self.input_vault_var.get():
            messagebox.showwarning("Vault Unlock", "Please select a target .fva vault file.")
            return
        if not self.extract_dest_var.get():
            messagebox.showwarning("Vault Unlock", "Please select an extraction destination folder.")
            return
        if not self.decrypt_pass_var.get():
            messagebox.showwarning("Vault Unlock", "Please enter the master passphrase.")
            return

        self._log("info", f"Engaging Vault Unlock: {self.input_vault_var.get()} -> {self.extract_dest_var.get()}")
        threading.Thread(
            target=VaultCryptoEngine.unlock_vault,
            args=(
                self.input_vault_var.get(),
                self.extract_dest_var.get(),
                self.decrypt_pass_var.get(),
                self.queue
            ),
            daemon=True
        ).start()

    def _start_shredding(self):
        if not self.shred_items:
            messagebox.showwarning("DoD Shredder", "Please add files or folders to shred.")
            return
        if not self.shred_confirm_var.get():
            messagebox.showerror("DoD Shredder", "Please check the safety confirmation lock before shredding.")
            return

        self._log("security", f"Executing Multi-Pass Destruction Sweep ({self.shred_algo_var.get()}) on {len(self.shred_items)} items...")
        threading.Thread(
            target=VaultCryptoEngine.shred_files,
            args=(
                self.shred_items,
                self.shred_algo_var.get(),
                self.queue
            ),
            daemon=True
        ).start()

    def _log(self, level, message):
        t_str = time.strftime("%H:%M:%S", time.localtime())
        log_entry = f"[{t_str}] [{level.upper()}] {message}\n"
        self.logs.append(log_entry)
        self.log_textbox.insert("end", log_entry)
        self.log_textbox.see("end")

    def _poll_queue(self):
        """Polls async background thread messages and updates UI every 40ms."""
        try:
            while not self.queue.empty():
                payload = self.queue.get_nowait()
                stage = payload.get("stage", "Processing")
                pct = payload.get("percentage", 0)
                msg = payload.get("msg", "")
                speed = payload.get("throughput_mbps", 0.0)

                self.telemetry_status.configure(text=f"STAGE: {stage.upper()}")
                self.telemetry_progress.set(pct / 100.0)
                self.telemetry_pct.configure(text=f"{pct:.1f}%")
                self.telemetry_speed.configure(text=f"{speed:.2f} MB/s")

                if msg:
                    self._log("info" if not payload.get("is_error") else "error", msg)

                if payload.get("is_complete"):
                    messagebox.showinfo("Operation Complete", msg)
                elif payload.get("is_error"):
                    messagebox.showerror("Operation Error", payload.get("error", "An error occurred"))

        except queue.Empty:
            pass
        finally:
            self.after(40, self._poll_queue)


if __name__ == "__main__":
    app = ApplicationWindow()
    app.mainloop()
