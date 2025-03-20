import os
import time
import logging
from logging.handlers import RotatingFileHandler
import gzip


def get_physicaldisk_size(physicaldisk_dir):
    """
    Calculate the total size of all files in the physicaldisk directory.

    Args:
        physicaldisk_dir (str): Path to the physicaldisk directory.

    Returns:
        int: Total size in bytes.
    """
    total_size = 0
    for file in os.listdir(physicaldisk_dir):
        total_size += os.path.getsize(os.path.join(physicaldisk_dir, file))
    return total_size


def get_physicaldisk_file_name(physicaldisk_dir, prefix, postfix=".upload"):
    """
    Lists all merged pdf files in the physicaldisk directory.

    Args:
        physicaldisk_dir (str): Path to the physicaldisk directory.
        prefix (str): Pseudo prefix hashcode.

    Returns:
        int: Total size in bytes.
    """
    for file in os.listdir(physicaldisk_dir):
        if prefix != file[:len(prefix)] or postfix != file[-len(postfix):]:
            continue
        return file
    return None


def get_physicaldisk_files(physicaldisk_dir, postfix=".upload"):
    """
    Lists all merged pdf files in the physicaldisk directory.

    Args:
        physicaldisk_dir (str): Path to the physicaldisk directory.

    Returns:
        int: Total size in bytes.
    """
    total_files = []
    for file in os.listdir(physicaldisk_dir):
        if postfix != file[-len(postfix):]:
            continue
        total_files.append(file)
    return total_files


def enforce_physicaldisk_limit(physicaldisk_dir, max_physicaldisk_size, timeout=5, postfix=".upload"):
    """
    Enforce the physicaldisk size limit by removing the oldest files (FIFO) with a timeout.

    Args:
        physicaldisk_dir (str): Path to the physicaldisk directory.
        max_physicaldisk_size (int): Maximum allowed size of physicaldisk in bytes.
        uploaded_files (dict): Dictionary tracking file metadata (timestamp and size).
        timeout (int): Maximum time in seconds to enforce the limit.

    Raises:
        TimeoutError: If the limit cannot be enforced within the timeout.
    """
    start_time = time.time()
    total_files = get_physicaldisk_files(physicaldisk_dir, postfix)
    total_files.sort(key=lambda x: x.split('-')[1])
    while get_physicaldisk_size(physicaldisk_dir) > max_physicaldisk_size:
        if time.time() - start_time > timeout:
            raise TimeoutError(
                "Timeout exceeded while enforcing physicaldisk size limit.")

        oldest_file = total_files[0]
        os.remove(os.path.join(physicaldisk_dir, oldest_file))
        del total_files[0]


def schedule_file_deletion(physicaldisk_dir, file_name, delay=300):
    """
    Schedule a file to be deleted after a given delay.

    Args:
        physicaldisk_dir (str): Path to the physicaldisk directory.
        file_name (str): Name of the file to delete.
        delay (int): Time in seconds before the file is deleted.
    """
    time.sleep(delay)
    file_path = os.path.join(physicaldisk_dir, file_name)
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
