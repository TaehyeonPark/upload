import os
import time
import logging
from logging.handlers import RotatingFileHandler
import gzip


def get_ramdisk_size(ramdisk_dir):
    """
    Calculate the total size of all files in the RAMDisk directory.

    Args:
        ramdisk_dir (str): Path to the RAMDisk directory.

    Returns:
        int: Total size in bytes.
    """
    total_size = 0
    for file in os.listdir(ramdisk_dir):
        total_size += os.path.getsize(os.path.join(ramdisk_dir, file))
    return total_size


def get_ramdisk_files(ramdisk_dir, postfix="merged.pdf"):
    """
    Lists all merged pdf files in the RAMDisk directory.

    Args:
        ramdisk_dir (str): Path to the RAMDisk directory.

    Returns:
        int: Total size in bytes.
    """
    total_files = []
    for file in os.listdir(ramdisk_dir):
        if postfix != file[-len(postfix):]:
            continue
        total_files.append(file)
    return total_files


def enforce_ramdisk_limit(ramdisk_dir, max_ramdisk_size, timeout=5, postfix="merged.pdf"):
    """
    Enforce the RAMDisk size limit by removing the oldest files (FIFO) with a timeout.

    Args:
        ramdisk_dir (str): Path to the RAMDisk directory.
        max_ramdisk_size (int): Maximum allowed size of RAMDisk in bytes.
        uploaded_files (dict): Dictionary tracking file metadata (timestamp and size).
        timeout (int): Maximum time in seconds to enforce the limit.

    Raises:
        TimeoutError: If the limit cannot be enforced within the timeout.
    """
    start_time = time.time()
    total_files = get_ramdisk_files(ramdisk_dir, postfix)
    total_files.sort(key=lambda x: x.split('-')[1])
    while get_ramdisk_size(ramdisk_dir) > max_ramdisk_size:
        if time.time() - start_time > timeout:
            raise TimeoutError(
                "Timeout exceeded while enforcing RAMDisk size limit.")

        oldest_file = total_files[0]
        os.remove(os.path.join(ramdisk_dir, oldest_file))
        del total_files[0]


def schedule_file_deletion(ramdisk_dir, file_name, delay=300):
    """
    Schedule a file to be deleted after a given delay.

    Args:
        ramdisk_dir (str): Path to the RAMDisk directory.
        file_name (str): Name of the file to delete.
        delay (int): Time in seconds before the file is deleted.
    """
    time.sleep(delay)
    file_path = os.path.join(ramdisk_dir, file_name)
    if os.path.exists(file_path):
        os.remove(file_path)


class CompressedRotatingFileHandler(RotatingFileHandler):

    def doRollover(self):
        super().doRollover()
        # 압축 처리: 백업된 로그 파일을 gzip으로 압축
        if self.backupCount > 0:
            log_file = f"{self.baseFilename}.1"
            if os.path.exists(log_file):
                with open(log_file, "rb") as f_in:
                    with gzip.open(f"{log_file}.gz", "wb") as f_out:
                        f_out.writelines(f_in)
                os.remove(log_file)  # 압축 후 원본 삭제
