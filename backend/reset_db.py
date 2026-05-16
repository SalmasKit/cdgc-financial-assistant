import os
import shutil
import database
import models

def reset_database():
    print("Connecting to database...")
    db = database.SessionLocal()
    try:
        print("Clearing tables...")
        # Order is important for foreign keys
        db.query(models.Ratio).delete()
        db.query(models.Analysis).delete()
        db.query(models.Document).delete()
        db.query(models.Alert).delete()
        db.query(models.Company).delete()
        db.query(models.ScrapeSource).delete()
        db.commit()
        print("Database tables cleared successfully (users table preserved).")
    except Exception as e:
        db.rollback()
        print(f"Error clearing database: {e}")
    finally:
        db.close()

    print("Clearing stored PDFs...")
    stored_dir = "stored_pdfs"
    if os.path.exists(stored_dir):
        for filename in os.listdir(stored_dir):
            file_path = os.path.join(stored_dir, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
        print("Stored PDFs directory cleared.")
    else:
        print("stored_pdfs directory does not exist.")

if __name__ == "__main__":
    reset_database()
