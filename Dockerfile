FROM python:3.10.12
RUN mkdir -p /upload
WORKDIR /upload
COPY . .
RUN pip install -r ./requirements.txt  
EXPOSE 50002
CMD python3 app.py

