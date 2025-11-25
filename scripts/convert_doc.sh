#!/bin/bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
/usr/bin/textutil -convert txt -stdout "$1"
