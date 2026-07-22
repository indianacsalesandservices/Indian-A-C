import sqlite3
c = sqlite3.connect(r'C:\Users\TONY\3D Objects\indian Ac\Billing system\instance\billing.db')
users = c.execute("SELECT username, role FROM b_user").fetchall()
print("BUser:", users)
print("Has 'staff'?:", ('staff', 'staff') in users)
c.close()
