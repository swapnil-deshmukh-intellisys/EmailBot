import schedule
import time
import email_bot

schedule.every().monday.at("11:56").do(email_bot.main)



while True:
    schedule.run_pending()
    time.sleep(60)
